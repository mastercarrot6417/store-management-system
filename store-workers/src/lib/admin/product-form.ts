import { CATEGORIES } from "../catalog";
import { malaysiaToday } from "../format";

/**
 * The Add / Edit Product form: reading and checking what was submitted.
 * Ported from add_product.php and edit_product.php, with stricter checks:
 * prices must be real amounts, and the category must be one the shop's
 * menus link to, so new products always show up under a menu.
 */

export const PRODUCT_STATUSES = ["ACTIVE", "HIDDEN", "OUT_OF_STOCK"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const STATUS_LABELS: Record<ProductStatus, string> = {
  ACTIVE: "Active",
  HIDDEN: "Hidden",
  OUT_OF_STOCK: "Out of Stock",
};

/** What the form shows. Kept as typed, so a rejected form comes back unchanged. */
export type ProductFormValues = {
  itemCode: string;
  name: string;
  brand: string;
  category: string;
  subCategory: string;
  status: ProductStatus;
  price: string;
  costPrice: string;
  onlineSellPrice: string;
  description: string;
  arrivalDate: string;
};

/** Checked values, ready to save. Amounts stay strings so NUMERIC columns get them exactly. */
export type ProductInput = Omit<ProductFormValues, "arrivalDate"> & { arrivalDate: string };

export function emptyProductForm(): ProductFormValues {
  return {
    itemCode: "",
    name: "",
    brand: "",
    category: "",
    subCategory: "",
    status: "ACTIVE",
    price: "",
    costPrice: "0.00",
    onlineSellPrice: "0.00",
    description: "",
    arrivalDate: malaysiaToday(),
  };
}

/** Up to RM 99,999,999.99 (the NUMERIC(10,2) columns), at most 2 decimal places. */
const AMOUNT = /^\d{1,8}(\.\d{1,2})?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function text(body: Record<string, unknown>, name: string, maxLength: number): string {
  const value = body[name];
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

/** Category + sub-category pairs the shop menus use. */
export function isShopCategory(category: string, subCategory: string): boolean {
  return CATEGORIES.some((c) => c.value === category && c.subCategories.some((s) => s.value === subCategory));
}

export type ParsedProductForm = { values: ProductFormValues; input: ProductInput | null; error: string | null };

/**
 * Reads the submitted form. `keep` is the product's saved category pair when
 * editing: an older product filed under a value the menus no longer use can
 * keep it without being forced to change.
 */
export function parseProductForm(
  body: Record<string, unknown>,
  opts: { isBoss: boolean; keep?: { category: string; subCategory: string } },
): ParsedProductForm {
  const status = text(body, "status", 20);
  const values: ProductFormValues = {
    itemCode: text(body, "item_code", 50),
    name: text(body, "name", 200),
    brand: text(body, "brand", 100),
    category: text(body, "category", 100),
    subCategory: text(body, "sub_category", 100),
    status: (PRODUCT_STATUSES as readonly string[]).includes(status) ? (status as ProductStatus) : "ACTIVE",
    price: text(body, "price", 20),
    costPrice: opts.isBoss ? text(body, "cost_price", 20) || "0" : "0",
    onlineSellPrice: opts.isBoss ? text(body, "online_sell_price", 20) || "0" : "0",
    description: text(body, "description", 5000),
    arrivalDate: text(body, "arrival_date", 10),
  };
  const fail = (error: string): ParsedProductForm => ({ values, input: null, error });

  if (!values.itemCode || !values.name || !values.brand || !values.category || !values.subCategory || !values.price) {
    return fail("Please fill in all required fields.");
  }
  const keptPair = opts.keep && opts.keep.category === values.category && opts.keep.subCategory === values.subCategory;
  if (!keptPair && !isShopCategory(values.category, values.subCategory)) {
    return fail("Please choose a category and a sub category from the lists.");
  }
  if (!AMOUNT.test(values.price)) return fail("Price must be an amount like 199 or 199.90.");
  if (!AMOUNT.test(values.costPrice)) return fail("Cost price must be an amount like 120 or 120.50.");
  if (!AMOUNT.test(values.onlineSellPrice)) return fail("Online sell price must be an amount like 189 or 189.90.");
  if (values.arrivalDate && !isRealDate(values.arrivalDate)) return fail("Arrival date is not a valid date.");

  return { values, input: { ...values, arrivalDate: values.arrivalDate || malaysiaToday() }, error: null };
}
