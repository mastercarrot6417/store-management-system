import { Hono } from "hono";
import {
  addColour,
  addImages,
  colourBelongsToProduct,
  deleteColour,
  deleteImage,
  getColourPage,
  MAX_COLOUR_NAME,
  saveColours,
  setMainImage,
  unusedImagePaths,
  type ColourEdit,
} from "../../lib/admin/colours";
import { deleteStoredImages, MAX_IMAGES_PER_UPLOAD, storeProductImage } from "../../lib/images";
import type { AppEnv } from "../../types";
import { ColoursPage } from "../../views/admin/ColoursPage";
import { formText } from "../render";
import { csrfToken, ID, redirectWithFlash, renderAdmin, toId } from "./shared";

/** /admin/products/:id/colours: colours and photos of one product. */
const colourRoutes = new Hono<AppEnv>();

const pagePath = (productId: number) => `/admin/products/${productId}/colours`;

colourRoutes.get(`/:id${ID}/colours`, async (c) => {
  const data = await getColourPage(c.var.db, Number(c.req.param("id")));
  if (!data) return redirectWithFlash(c, "/admin/products", "error", "That product doesn't exist.");
  return renderAdmin(c, { title: "Colours & Images", active: "products" }, <ColoursPage data={data} csrfToken={csrfToken(c)} />);
});

/** Every POST below works on an existing product; anything else goes back to the list. */
colourRoutes.post(`/:id${ID}/colours/*`, async (c, next) => {
  const [exists] = await c.var.db`SELECT 1 FROM products WHERE id = ${Number(c.req.param("id"))}`;
  if (!exists) return redirectWithFlash(c, "/admin/products", "error", "That product doesn't exist.");
  await next();
});

colourRoutes.post(`/:id${ID}/colours/add`, async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.parseBody();
  const error = await addColour(
    c.var.db,
    id,
    formText(body, "color_name", MAX_COLOUR_NAME),
    formText(body, "color_code", 7),
    body.is_default === "1",
  );
  if (error) return redirectWithFlash(c, pagePath(id), "error", error);
  return redirectWithFlash(c, pagePath(id), "success", "Colour added successfully.");
});

colourRoutes.post(`/:id${ID}/colours/save`, async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.parseBody({ all: true });
  const rawIds = body["color_ids[]"];
  const colourIds = (Array.isArray(rawIds) ? rawIds : [rawIds]).map(toId).filter((n) => n > 0);
  const edits: ColourEdit[] = colourIds.map((colourId) => ({
    id: colourId,
    name: formText(body, `color_name_${colourId}`, MAX_COLOUR_NAME),
    code: formText(body, `color_code_${colourId}`, 7),
  }));

  const error = await saveColours(c.var.db, id, edits, toId(body.default_color_id));
  if (error) return redirectWithFlash(c, pagePath(id), "error", error);
  return redirectWithFlash(c, pagePath(id), "success", "Colour details saved successfully.");
});

colourRoutes.post(`/:id${ID}/colours/:colourId${ID}/delete`, async (c) => {
  const id = Number(c.req.param("id"));
  const result = await deleteColour(c.var.db, id, Number(c.req.param("colourId")));
  if (!result.ok) return redirectWithFlash(c, pagePath(id), "error", result.error);
  await deleteStoredImages(c.env.IMAGES, await unusedImagePaths(c.var.db, result.imagePaths));
  return redirectWithFlash(c, pagePath(id), "success", "Colour and its images were deleted.");
});

colourRoutes.post(`/:id${ID}/colours/:colourId${ID}/images`, async (c) => {
  const id = Number(c.req.param("id"));
  const colourId = Number(c.req.param("colourId"));
  if (!(await colourBelongsToProduct(c.var.db, colourId, id))) {
    return redirectWithFlash(c, pagePath(id), "error", "Invalid colour selected.");
  }

  const body = await c.req.parseBody({ all: true });
  const raw = body["images[]"];
  const files = (Array.isArray(raw) ? raw : [raw]).filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return redirectWithFlash(c, pagePath(id), "error", "Please select at least one image.");
  if (files.length > MAX_IMAGES_PER_UPLOAD) {
    return redirectWithFlash(c, pagePath(id), "error", `Please upload at most ${MAX_IMAGES_PER_UPLOAD} images at a time.`);
  }

  const stored: string[] = [];
  for (const file of files) {
    const path = await storeProductImage(c.env.IMAGES, id, colourId, file);
    if (path) stored.push(path);
  }
  try {
    await addImages(c.var.db, id, colourId, stored);
  } catch (err) {
    // Don't leave files in R2 that no product points at.
    await deleteStoredImages(c.env.IMAGES, stored);
    throw err;
  }

  const skipped = files.length - stored.length;
  const message =
    `${stored.length} image(s) uploaded.` +
    (skipped ? ` ${skipped} skipped (only JPEG, PNG, GIF or WebP images up to 5 MB).` : "");
  return redirectWithFlash(c, pagePath(id), stored.length > 0 ? "success" : "error", message);
});

colourRoutes.post(`/:id${ID}/colours/images/:imageId${ID}/main`, async (c) => {
  const id = Number(c.req.param("id"));
  const ok = await setMainImage(c.var.db, id, Number(c.req.param("imageId")));
  return redirectWithFlash(c, pagePath(id), ok ? "success" : "error", ok ? "Main image updated." : "Image not found.");
});

colourRoutes.post(`/:id${ID}/colours/images/:imageId${ID}/delete`, async (c) => {
  const id = Number(c.req.param("id"));
  const path = await deleteImage(c.var.db, id, Number(c.req.param("imageId")));
  if (!path) return redirectWithFlash(c, pagePath(id), "error", "Image not found.");
  await deleteStoredImages(c.env.IMAGES, await unusedImagePaths(c.var.db, [path]));
  return redirectWithFlash(c, pagePath(id), "success", "Image deleted.");
});

export default colourRoutes;
