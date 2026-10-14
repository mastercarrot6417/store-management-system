import bcrypt from "bcryptjs";

/**
 * Password hashing compatible with the PHP site (password_hash / password_verify).
 *
 * - Existing PHP hashes start with "$2y$"; bcryptjs checks them as they are.
 * - New hashes are saved with the "$2y$" prefix (same algorithm as bcryptjs's "$2b$"),
 *   so the PHP site can still check them while both sites run.
 *
 * A check costs ~50ms of CPU, so password logins need the Workers Paid plan
 * (the free plan allows 10ms per request).
 */

/** PHP's default cost. */
const COST = 10;

/** bcrypt only uses the first 72 bytes of a password. */
export const MAX_PASSWORD_BYTES = 72;
export const MIN_PASSWORD_LENGTH = 8;

/** Accounts created through Google have no password. This value can never match one. */
export const NO_PASSWORD = "!google-login-only";

export async function hashPassword(password: string): Promise<string> {
  const hash = await bcrypt.hash(password, COST);
  return hash.replace(/^\$2[ab]\$/, "$2y$");
}

/**
 * Hash used when no account matches, so a login for an unknown email takes as
 * long as one for a real email and the response time doesn't reveal which emails exist.
 */
const DUMMY_HASH = "$2y$10$ORlywmMrdedjCdTBSr57VekGwdijvvvbjn78xbjn7/ETeTF2/Xgzi";

/** Checks a password against a stored hash. Pass null when no account was found. */
export async function verifyPassword(password: string, storedHash: string | null): Promise<boolean> {
  const isBcrypt = storedHash !== null && /^\$2[abxy]\$\d\d\$/.test(storedHash);
  const ok = await bcrypt.compare(password, isBcrypt ? storedHash : DUMMY_HASH);
  return isBcrypt && ok;
}

/** Returns an error message, or null if the password is acceptable for a new account. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) return "Password is too long (maximum 72 characters).";
  return null;
}
