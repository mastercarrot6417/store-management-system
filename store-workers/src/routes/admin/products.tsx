import { Hono } from "hono";
import { emptyProductForm, parseProductForm, type ProductFormValues } from "../../lib/admin/product-form";
import { archiveProduct, createProduct, getAdminProduct, listAdminProducts, restoreProduct, updateProduct } from "../../lib/admin/products";
import type { AppEnv } from "../../types";
import { ProductFormPage } from "../../views/admin/ProductFormPage";
import { ProductListPage } from "../../views/admin/ProductListPage";
import { csrfToken, currentAdmin, ID, redirectWithFlash, renderAdmin, requireBoss } from "./shared";

/** /admin/products: list, add, edit, archive / restore. */
const productRoutes = new Hono<AppEnv>();

productRoutes.get("/", async (c) => {
  const filters = {
    search: (c.req.query("search") ?? "").trim().slice(0, 100),
    category: (c.req.query("category") ?? "").trim().slice(0, 100),
    subCategory: (c.req.query("sub_category") ?? "").trim().slice(0, 100),
    archived: c.req.query("view") === "archived",
  };
  const isBoss = currentAdmin(c).role === "boss";
  const products = await listAdminProducts(c.var.db, filters, isBoss);
  return renderAdmin(
    c,
    { title: filters.archived ? "Archived Products" : "Manage Products", active: "products" },
    <ProductListPage products={products} filters={filters} isBoss={isBoss} csrfToken={csrfToken(c)} />,
  );
});

productRoutes.get("/new", (c) => {
  const isBoss = currentAdmin(c).role === "boss";
  return renderAdmin(
    c,
    { title: "Add Product", active: "add-product" },
    <ProductFormPage values={emptyProductForm()} error={null} isBoss={isBoss} csrfToken={csrfToken(c)} />,
  );
});

productRoutes.post("/new", async (c) => {
  const isBoss = currentAdmin(c).role === "boss";
  const form = parseProductForm(await c.req.parseBody(), { isBoss });
  const showError = (values: ProductFormValues, error: string) =>
    renderAdmin(
      c,
      { title: "Add Product", active: "add-product" },
      <ProductFormPage values={values} error={error} isBoss={isBoss} csrfToken={csrfToken(c)} />,
      400,
    );

  if (!form.input) return showError(form.values, form.error!);
  const saved = await createProduct(c.var.db, form.input);
  if (!saved.ok) return showError(form.values, saved.error);
  return redirectWithFlash(c, `/admin/products/${saved.id}/colours`, "success", `Product "${form.input.name}" added! Now set up its colours and images.`);
});

productRoutes.get(`/:id${ID}`, (c) => c.redirect(`/admin/products/${c.req.param("id")}/edit`));

productRoutes.get(`/:id${ID}/edit`, async (c) => {
  const product = await getAdminProduct(c.var.db, Number(c.req.param("id")));
  if (!product) return redirectWithFlash(c, "/admin/products", "error", "That product doesn't exist.");
  const isBoss = currentAdmin(c).role === "boss";
  const values: ProductFormValues = {
    itemCode: product.itemCode,
    name: product.name,
    brand: product.brand,
    category: product.category,
    subCategory: product.subCategory,
    status: product.status,
    price: product.price,
    costPrice: product.costPrice,
    onlineSellPrice: product.onlineSellPrice,
    description: product.description,
    arrivalDate: product.arrivalDate,
  };
  return renderAdmin(
    c,
    { title: "Edit Product", active: "products" },
    <ProductFormPage values={values} error={null} isBoss={isBoss} csrfToken={csrfToken(c)} product={product} />,
  );
});

productRoutes.post(`/:id${ID}/edit`, async (c) => {
  const id = Number(c.req.param("id"));
  const product = await getAdminProduct(c.var.db, id);
  if (!product) return redirectWithFlash(c, "/admin/products", "error", "That product doesn't exist.");

  const isBoss = currentAdmin(c).role === "boss";
  const form = parseProductForm(await c.req.parseBody(), {
    isBoss,
    keep: { category: product.category, subCategory: product.subCategory },
  });
  const showError = (error: string) =>
    renderAdmin(
      c,
      { title: "Edit Product", active: "products" },
      <ProductFormPage values={form.values} error={error} isBoss={isBoss} csrfToken={csrfToken(c)} product={product} />,
      400,
    );

  if (!form.input) return showError(form.error!);
  const saved = await updateProduct(c.var.db, id, form.input, isBoss);
  if (!saved.ok) return showError(saved.error);
  return redirectWithFlash(
    c,
    "/admin/products",
    "success",
    "Product details updated successfully. Stock quantity changes must be done through Stock In or Stock Out.",
  );
});

productRoutes.post(`/:id${ID}/archive`, requireBoss("Only boss admins can archive products.", "/admin/products"), async (c) => {
  const name = await archiveProduct(c.var.db, Number(c.req.param("id")));
  if (!name) return redirectWithFlash(c, "/admin/products", "error", "That product doesn't exist or is already archived.");
  return redirectWithFlash(c, "/admin/products", "success", `"${name}" was archived. Its stock history is kept.`);
});

productRoutes.post(`/:id${ID}/restore`, requireBoss("Only boss admins can restore products.", "/admin/products?view=archived"), async (c) => {
  const id = Number(c.req.param("id"));
  const name = await restoreProduct(c.var.db, id);
  if (!name) return redirectWithFlash(c, "/admin/products?view=archived", "error", "That product doesn't exist or isn't archived.");
  return redirectWithFlash(c, `/admin/products/${id}/edit`, "success", `"${name}" was restored. It's still Hidden: set it to Active when it should be on sale.`);
});

export default productRoutes;
