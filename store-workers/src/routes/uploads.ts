import { Hono } from "hono";
import type { AppEnv } from "../types";

/**
 * Serves product images from the R2 bucket at the same paths the PHP site
 * used (/uploads/pimg_...jpg), so image paths stored in the database still work.
 */
const uploadRoutes = new Hono<AppEnv>();

/** Only these file types are served, with a fixed content type, so nothing in the bucket can be served as a web page. */
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

uploadRoutes.get("/:name", async (c) => {
  const name = c.req.param("name");
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[extension];
  if (!SAFE_NAME.test(name) || name.startsWith(".") || !contentType) return c.notFound();

  const object = await c.env.IMAGES.get(`uploads/${name}`);
  if (!object) return c.notFound();

  return c.body(object.body, 200, {
    "Content-Type": contentType,
    // Upload names are random and never reused, so browsers can keep them for a year.
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: object.httpEtag,
  });
});

export default uploadRoutes;
