import { CATEGORIES, type SubCategory } from "../../lib/catalog";

type Props = {
  category: string;
  subCategory: string;
  categoryName: string;
  subCategoryName: string;
  /** Form mode: both required, with "-- Select --" placeholders. Filter mode: "All ..." options. */
  mode: "form" | "filter";
  /** A saved pair the menus no longer list (older products), kept as a choice. */
  keep?: { category: string; subCategory: string };
};

/**
 * Category + sub-category dropdowns. The sub-category list follows the chosen
 * category (admin.js rebuilds it from data-subcategories), and works without
 * JavaScript too because the server fills it for the current category.
 */
export function CategorySelects(props: Props) {
  const map: Record<string, SubCategory[]> = {};
  for (const c of CATEGORIES) map[c.value] = [...c.subCategories];
  const categories = CATEGORIES.map((c) => ({ value: c.value, label: c.value }));
  if (props.keep) {
    const { category, subCategory } = props.keep;
    if (!map[category]) {
      map[category] = [];
      categories.push({ value: category, label: category });
    }
    if (!map[category]!.some((s) => s.value === subCategory)) map[category]!.push({ value: subCategory, label: subCategory });
  }

  const subOptions = props.category ? map[props.category] ?? [] : props.mode === "filter" ? Object.values(map).flat() : [];
  const placeholderCategory = props.mode === "form" ? "-- Select Category --" : "All Categories";
  const placeholderSub = props.mode === "form" ? "-- Select Sub Category --" : "All Subcategories";
  const required = props.mode === "form";
  const subId = `${props.subCategoryName}-select`;

  const categorySelect = (
    <select
      name={props.categoryName}
      id={`${props.categoryName}-select`}
      required={required}
      class="js-category-select"
      data-sub-select={subId}
      data-subcategories={JSON.stringify(map)}
      data-placeholder={placeholderSub}
      data-mode={props.mode}
    >
      <option value="">{placeholderCategory}</option>
      {categories.map((c) => (
        <option value={c.value} selected={c.value === props.category}>{c.label}</option>
      ))}
    </select>
  );
  const subSelect = (
    <select name={props.subCategoryName} id={subId} required={required}>
      <option value="">{placeholderSub}</option>
      {subOptions.map((s) => (
        <option value={s.value} selected={s.value === props.subCategory}>{s.label}</option>
      ))}
    </select>
  );

  if (props.mode === "filter") {
    return (
      <>
        {categorySelect}
        {subSelect}
      </>
    );
  }
  return (
    <div class="form-row">
      <div class="form-group">
        <label for={`${props.categoryName}-select`}>Main Category <span class="required">*</span></label>
        {categorySelect}
      </div>
      <div class="form-group">
        <label for={subId}>Sub Category <span class="required">*</span></label>
        {subSelect}
      </div>
    </div>
  );
}
