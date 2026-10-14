/** "1234.5" -> "1,234.50", like PHP's number_format($price, 2). */
export function formatPrice(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Turns a stored image path ("uploads/pimg_1.jpg") into a link that works from
 * any page ("/uploads/pimg_1.jpg"). The PHP pages used relative links, which
 * would break on nested addresses like /product/5.
 */
export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `/${path.replace(/^\/+/, "")}`;
}

/** 1234 -> "1,234", like PHP's number_format($n). */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "2026-07-08 17:59:00" -> "08 Jul 2026 17:59" (or "08 Jul, 17:59" without the year).
 * Database times are already Malaysia wall-clock time (see db.ts), so no time zone maths.
 */
export function formatDateTime(value: string | null | undefined, withYear = true): string {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value);
  if (!m) return value;
  const [, year, month, day, hour, minute] = m;
  const mon = MONTHS[Number(month) - 1] ?? month;
  return withYear ? `${day} ${mon} ${year} ${hour}:${minute}` : `${day} ${mon}, ${hour}:${minute}`;
}

/** Today's date in Malaysia as "YYYY-MM-DD". */
export function malaysiaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(now);
}

/** The current Malaysia time as "YYYY-MM-DD HH:MM:SS", the same shape as database times. */
export function malaysiaNow(now = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/** "2026-10-15" -> "15 Oct 2026". */
export function formatDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate;
  return `${m[3]} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/**
 * JSON for a <script type="application/json"> block. Escapes "<" so text like
 * "</script>" inside product data can't end the block early.
 */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
