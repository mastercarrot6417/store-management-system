import type { CustomerProfile } from "../../lib/accounts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-07-03 13:02:41.37" -> "03 Jul 2026" (like PHP's date('d M Y')), without time zone conversion. */
function joinedDate(value: string | null): string {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "-";
  return `${match[3]} ${MONTHS[Number(match[2]) - 1] ?? ""} ${match[1]}`;
}

/** Only https:// pictures (from Google) are shown. */
function safePicture(url: string | null): string | null {
  return url && /^https:\/\//i.test(url) ? url : null;
}

/** The customer's account page, ported from user_page.php. */
export function AccountPage({ customer }: { customer: CustomerProfile }) {
  const picture = safePicture(customer.profilePicture);
  const provider = customer.authProvider.charAt(0).toUpperCase() + customer.authProvider.slice(1);

  return (
    <main class="account-shell">
      <section class="account-hero reveal-on-scroll">
        <p class="section-eyebrow">Customer Account</p>
        <h1>Welcome, {customer.fullName}</h1>
        <p>Manage your customer profile and continue browsing premium helmets and riding gear.</p>
      </section>

      <section class="account-card reveal-on-scroll">
        <div class="account-avatar">
          {picture ? (
            <img src={picture} alt="Profile picture" referrerpolicy="no-referrer" />
          ) : (
            <span>{customer.fullName.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div class="account-info-grid">
          <div><strong>Full Name</strong><span>{customer.fullName}</span></div>
          <div><strong>Email</strong><span>{customer.email}</span></div>
          <div><strong>Phone</strong><span>{customer.phone || "Not added"}</span></div>
          <div><strong>Login Type</strong><span>{provider}</span></div>
          <div><strong>Joined</strong><span>{joinedDate(customer.createdAt)}</span></div>
        </div>
        <div class="account-actions">
          <a href="/" class="btn-hero-primary">Continue Shopping</a>
          <a href="/logout" class="btn-hero-ghost account-logout-btn">Log Out</a>
        </div>
      </section>
    </main>
  );
}
