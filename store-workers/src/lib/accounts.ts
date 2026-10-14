import type { Sql } from "./db";
import type { GoogleProfile } from "./google";
import { NO_PASSWORD } from "./passwords";

/**
 * Customer and admin account queries, ported from login.php, signup.php,
 * google_callback.php and admin/login.php. Emails are matched exactly, as the
 * PHP site does.
 */

export async function findCustomerForLogin(sql: Sql, email: string): Promise<{ id: number; password: string } | null> {
  const [row] = await sql<{ id: string; password: string }[]>`
    SELECT id, password FROM customers WHERE email = ${email} LIMIT 1`;
  return row ? { id: Number(row.id), password: row.password } : null;
}

export async function findAdminForLogin(sql: Sql, email: string): Promise<{ id: number; password: string } | null> {
  const [row] = await sql<{ id: string; password: string }[]>`
    SELECT id, password FROM admin WHERE email = ${email} LIMIT 1`;
  return row ? { id: Number(row.id), password: row.password } : null;
}

export async function findAdminIdByEmail(sql: Sql, email: string): Promise<number | null> {
  const [row] = await sql<{ id: string }[]>`SELECT id FROM admin WHERE email = ${email} LIMIT 1`;
  return row ? Number(row.id) : null;
}

export type NewCustomer = { fullName: string; email: string; phone: string; passwordHash: string };

/** Creates an email/password customer. Returns null if the email is already registered. */
export async function createCustomer(sql: Sql, customer: NewCustomer): Promise<number | null> {
  try {
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO customers (full_name, email, phone, password, auth_provider)
      VALUES (${customer.fullName}, ${customer.email}, ${customer.phone}, ${customer.passwordHash}, 'email')
      RETURNING id`;
    return Number(row!.id);
  } catch (err) {
    // 23505 = unique_violation: the email was registered (possibly at the same moment).
    if ((err as { code?: string }).code === "23505") return null;
    throw err;
  }
}

export async function customerEmailExists(sql: Sql, email: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM customers WHERE email = ${email} LIMIT 1`;
  return rows.length > 0;
}

/**
 * Finds the customer for a Google login (by Google ID, then by email) and
 * links Google to it, or creates a new customer. Same behaviour as google_callback.php.
 */
export async function upsertGoogleCustomer(sql: Sql, profile: GoogleProfile): Promise<number> {
  const [existing] = await sql<{ id: string }[]>`
    SELECT id FROM customers WHERE google_id = ${profile.sub} OR email = ${profile.email}
    ORDER BY (google_id = ${profile.sub}) DESC NULLS LAST
    LIMIT 1`;

  if (existing) {
    await sql`
      UPDATE customers
      SET google_id = ${profile.sub},
          auth_provider = 'google',
          profile_picture = ${profile.picture},
          full_name = COALESCE(NULLIF(full_name, ''), ${profile.name})
      WHERE id = ${existing.id}`;
    return Number(existing.id);
  }

  const [created] = await sql<{ id: string }[]>`
    INSERT INTO customers (full_name, email, phone, password, google_id, auth_provider, profile_picture)
    VALUES (${profile.name}, ${profile.email}, '', ${NO_PASSWORD}, ${profile.sub}, 'google', ${profile.picture})
    RETURNING id`;
  return Number(created!.id);
}

export type CustomerProfile = {
  fullName: string;
  email: string;
  phone: string | null;
  authProvider: string;
  profilePicture: string | null;
  /** "2026-07-03 13:02:41.377743", Malaysia time as stored. */
  createdAt: string | null;
};

export async function getCustomerProfile(sql: Sql, id: number): Promise<CustomerProfile | null> {
  const [row] = await sql<{
    full_name: string; email: string; phone: string | null; auth_provider: string | null;
    profile_picture: string | null; created_at: string | null;
  }[]>`
    SELECT full_name, email, phone, auth_provider, profile_picture, created_at
    FROM customers WHERE id = ${id}`;
  if (!row) return null;
  return {
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    authProvider: row.auth_provider || "email",
    profilePicture: row.profile_picture,
    createdAt: row.created_at,
  };
}
