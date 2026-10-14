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

/**
 * JSON for a <script type="application/json"> block. Escapes "<" so text like
 * "</script>" inside product data can't end the block early.
 */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
