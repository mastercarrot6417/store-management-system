import { Hono, type Context } from "hono";
import { getStockFormData, MAX_NOTE_LENGTH, MAX_SIZE_LENGTH, stockIn, stockOut } from "../../lib/admin/inventory";
import type { AppEnv } from "../../types";
import { EMPTY_MOVEMENT, StockMovementPage, type MovementFormValues } from "../../views/admin/StockMovementPage";
import { formText } from "../render";
import { csrfToken, currentAdmin, redirectWithFlash, renderAdmin, toId } from "./shared";

/** /admin/stock/in and /admin/stock/out. */
const stockRoutes = new Hono<AppEnv>();

const TITLES = { in: "Stock In", out: "Stock Out" } as const;

async function showForm(
  c: Context<AppEnv>,
  mode: "in" | "out",
  productId: number,
  colourId: number,
  values: MovementFormValues,
  error: string | null = null,
) {
  const data = await getStockFormData(c.var.db, productId || null, colourId || null);
  // Coming from a link with ?size=M (e.g. after a Stock Out), pick that size in the Stock Out list.
  if (mode === "out" && !values.sizeId && values.size) {
    values = { ...values, sizeId: data.sizes.find((s) => s.size === values.size)?.id ?? 0 };
  }
  return renderAdmin(
    c,
    { title: TITLES[mode], active: mode === "in" ? "stock-in" : "stock-out" },
    <StockMovementPage mode={mode} data={data} values={values} error={error} csrfToken={csrfToken(c)} />,
    error ? 400 : 200,
  );
}

function readQuery(c: Context<AppEnv>) {
  return {
    productId: toId(c.req.query("product_id")),
    colourId: toId(c.req.query("color_id")),
    size: (c.req.query("size") ?? "").trim().slice(0, MAX_SIZE_LENGTH),
    sizeId: toId(c.req.query("size_id")),
  };
}

function backTo(mode: "in" | "out", productId: number, colourId: number, size: string): string {
  const params = new URLSearchParams({ product_id: String(productId), color_id: String(colourId), size });
  return `/admin/stock/${mode}?${params}`;
}

function quantityOf(value: string): number {
  return /^\d{1,9}$/.test(value) ? Number(value) : 0;
}

stockRoutes.get("/in", (c) => {
  const q = readQuery(c);
  return showForm(c, "in", q.productId, q.colourId, { ...EMPTY_MOVEMENT, size: q.size });
});

stockRoutes.get("/out", (c) => {
  const q = readQuery(c);
  return showForm(c, "out", q.productId, q.colourId, { ...EMPTY_MOVEMENT, size: q.size, sizeId: q.sizeId });
});

stockRoutes.post("/in", async (c) => {
  const body = await c.req.parseBody();
  const productId = toId(body.product_id);
  const colourId = toId(body.color_id);
  const values: MovementFormValues = {
    ...EMPTY_MOVEMENT,
    size: formText(body, "existing_size", MAX_SIZE_LENGTH),
    newSize: formText(body, "new_size", MAX_SIZE_LENGTH + 1),
    quantity: formText(body, "quantity", 12),
    reason: formText(body, "reason", 100),
    note: formText(body, "note", MAX_NOTE_LENGTH),
  };

  const result = await stockIn(
    c.var.db,
    {
      productId,
      colourId,
      // A typed new size wins over the dropdown, as on the PHP page.
      size: values.newSize || values.size,
      quantity: quantityOf(values.quantity),
      reason: values.reason,
      note: values.note,
    },
    currentAdmin(c),
  );
  if (!result.ok) return showForm(c, "in", productId, colourId, values, `Failed to record Stock In: ${result.error}`);
  return redirectWithFlash(
    c,
    backTo("in", productId, colourId, result.size),
    "success",
    `Stock In recorded successfully. Size ${result.size}: ${result.before} → ${result.after} unit(s).`,
  );
});

stockRoutes.post("/out", async (c) => {
  const body = await c.req.parseBody();
  const productId = toId(body.product_id);
  const colourId = toId(body.color_id);
  const values: MovementFormValues = {
    ...EMPTY_MOVEMENT,
    sizeId: toId(body.size_id),
    quantity: formText(body, "quantity", 12),
    reason: formText(body, "reason", 100),
    note: formText(body, "note", MAX_NOTE_LENGTH),
  };

  const result = await stockOut(
    c.var.db,
    { productId, colourId, sizeId: values.sizeId, quantity: quantityOf(values.quantity), reason: values.reason, note: values.note },
    currentAdmin(c),
  );
  if (!result.ok) return showForm(c, "out", productId, colourId, values, `Failed to record Stock Out: ${result.error}`);
  return redirectWithFlash(
    c,
    backTo("out", productId, colourId, result.size),
    "success",
    `Stock Out recorded successfully. Size ${result.size}: ${result.before} → ${result.after} unit(s).`,
  );
});

export default stockRoutes;
