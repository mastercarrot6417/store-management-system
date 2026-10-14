/**
 * Shop categories and sub-categories, as used by the PHP navbar and footer.
 * `value` is what's stored in products.category / products.sub_category.
 */

export type SubCategory = { value: string; label: string };
export type Category = { value: string; label: string; subCategories: SubCategory[] };

export const CATEGORIES: Category[] = [
  {
    value: "Helmet",
    label: "Helmets",
    subCategories: [
      { value: "Full Face Helmet", label: "Full Face Helmet" },
      { value: "Open Face Helmet", label: "Open Face Helmet" },
      { value: "Flip Up Helmet", label: "Flip Up Helmet" },
      { value: "Kid Helmet", label: "Kid Helmet" },
    ],
  },
  {
    value: "Apparel",
    label: "Apparel",
    subCategories: [
      { value: "Jackets", label: "Jackets" },
      { value: "Pants", label: "Pants" },
      { value: "Gloves", label: "Gloves" },
      { value: "Rain Gear", label: "Rain Gear" },
    ],
  },
  {
    value: "Accessories",
    label: "Accessories",
    subCategories: [
      { value: "Bag", label: "Bags" },
      { value: "Disc Lock", label: "Disc Lock" },
      { value: "Helmet Accessories", label: "Helmet Accessories" },
      { value: "Other", label: "Other Accessories" },
    ],
  },
];

/** Link to the shop listing filtered by category (and optionally sub-category). */
export function categoryUrl(category: string, subCategory?: string): string {
  const params = new URLSearchParams({ category });
  if (subCategory) params.set("sub_category", subCategory);
  return `/?${params}`;
}
