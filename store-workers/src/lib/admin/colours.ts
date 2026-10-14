import type { Sql } from "../db";

/**
 * Colours and photos of one product, ported from admin/manage_product_colors.php.
 * Every change checks that the colour or image belongs to the product in the
 * address, so a form can't be pointed at another product's data.
 */

/** A colour code is always "#" plus 6 hex digits. Checked on every save. */
export const COLOUR_CODE = /^#[0-9a-fA-F]{6}$/;
export const MAX_COLOUR_NAME = 60;

export type ColourImage = { id: number; path: string; isMain: boolean };
export type ColourCard = { id: number; name: string; code: string; isDefault: boolean; stock: number; images: ColourImage[] };
export type ColourPageData = {
  product: { id: number; name: string; itemCode: string; category: string; subCategory: string; brand: string; archived: boolean };
  colours: ColourCard[];
};

export async function getColourPage(sql: Sql, productId: number): Promise<ColourPageData | null> {
  const [product] = await sql<{
    id: string; name: string; item_code: string; category: string; sub_category: string; brand: string; archived: boolean;
  }[]>`
    SELECT id, name, item_code, category, sub_category, brand, archived_at IS NOT NULL AS archived
    FROM products WHERE id = ${productId}`;
  if (!product) return null;

  const [colours, stock, images] = await Promise.all([
    sql<{ id: string; color_name: string; color_code: string; is_default: boolean }[]>`
      SELECT id, color_name, color_code, is_default FROM product_colors
      WHERE product_id = ${productId}
      ORDER BY is_default DESC, id ASC`,
    sql<{ color_id: string; total: string }[]>`
      SELECT color_id, COALESCE(SUM(quantity), 0) AS total FROM product_sizes
      WHERE product_id = ${productId} AND color_id IS NOT NULL
      GROUP BY color_id`,
    sql<{ id: string; color_id: string; image_path: string; is_main: boolean }[]>`
      SELECT id, color_id, image_path, is_main FROM product_images
      WHERE product_id = ${productId} AND color_id IS NOT NULL
      ORDER BY is_main DESC, sort_order ASC, id ASC`,
  ]);

  const stockByColour = new Map(stock.map((s) => [s.color_id, Number(s.total)]));
  return {
    product: {
      id: Number(product.id),
      name: product.name,
      itemCode: product.item_code,
      category: product.category,
      subCategory: product.sub_category,
      brand: product.brand,
      archived: product.archived,
    },
    colours: colours.map((c) => ({
      id: Number(c.id),
      name: c.color_name,
      code: COLOUR_CODE.test(c.color_code) ? c.color_code : "#000000",
      isDefault: c.is_default,
      stock: stockByColour.get(c.id) ?? 0,
      images: images
        .filter((img) => img.color_id === c.id)
        .map((img) => ({ id: Number(img.id), path: img.image_path, isMain: img.is_main })),
    })),
  };
}

export async function colourBelongsToProduct(sql: Sql, colourId: number, productId: number): Promise<boolean> {
  const [row] = await sql`SELECT 1 FROM product_colors WHERE id = ${colourId} AND product_id = ${productId}`;
  return Boolean(row);
}

/** Returns an error message, or null when saved. The first colour always becomes the default. */
export async function addColour(sql: Sql, productId: number, name: string, code: string, makeDefault: boolean): Promise<string | null> {
  if (!name) return "Colour name is required.";
  if (!COLOUR_CODE.test(code)) return "Colour code must look like #1a1a1a.";

  await sql.begin(async (tx) => {
    // Locks the product so two admins adding first colours at once can't both become the default.
    await tx`SELECT id FROM products WHERE id = ${productId} FOR UPDATE`;
    const [countRow] = await tx<{ count: string }[]>`SELECT COUNT(*) AS count FROM product_colors WHERE product_id = ${productId}`;
    const isDefault = makeDefault || Number(countRow!.count) === 0;
    if (isDefault) await tx`UPDATE product_colors SET is_default = FALSE WHERE product_id = ${productId}`;
    await tx`
      INSERT INTO product_colors (product_id, color_name, color_code, is_default)
      VALUES (${productId}, ${name}, ${code}, ${isDefault})`;
  });
  return null;
}

export type ColourEdit = { id: number; name: string; code: string };

/** Saves names, codes and the default colour together. Returns an error message, or null when saved. */
export async function saveColours(sql: Sql, productId: number, edits: ColourEdit[], defaultId: number): Promise<string | null> {
  if (edits.length === 0) return "There are no colours to update.";
  for (const edit of edits) {
    if (!edit.name) return "Each colour must have a name.";
    if (!COLOUR_CODE.test(edit.code)) return `"${edit.name}" has an invalid colour code. Use a code like #1a1a1a.`;
  }

  return sql.begin(async (tx) => {
    const owned = await tx<{ id: string }[]>`
      SELECT id FROM product_colors
      WHERE product_id = ${productId} AND id IN ${tx(edits.map((e) => e.id))}
      FOR UPDATE`;
    const ownedIds = new Set(owned.map((r) => Number(r.id)));
    const valid = edits.filter((e) => ownedIds.has(e.id));
    if (valid.length === 0) return "No valid colours were found to update.";

    await tx`UPDATE product_colors SET is_default = FALSE WHERE product_id = ${productId}`;
    for (const edit of valid) {
      await tx`
        UPDATE product_colors SET color_name = ${edit.name}, color_code = ${edit.code}, is_default = ${edit.id === defaultId}
        WHERE id = ${edit.id} AND product_id = ${productId}`;
    }
    // If the chosen default wasn't one of this product's colours, keep exactly one default anyway.
    const [hasDefault] = await tx`SELECT 1 FROM product_colors WHERE product_id = ${productId} AND is_default`;
    if (!hasDefault) {
      await tx`
        UPDATE product_colors SET is_default = TRUE
        WHERE id = (SELECT id FROM product_colors WHERE product_id = ${productId} ORDER BY id LIMIT 1)`;
    }
    return null;
  });
}

export type DeleteColourResult = { ok: true; imagePaths: string[] } | { ok: false; error: string };

/**
 * Deletes a colour with its photos and its empty size rows. Refused while it
 * still has stock (Stock Out first). Stock history keeps its rows.
 */
export async function deleteColour(sql: Sql, productId: number, colourId: number): Promise<DeleteColourResult> {
  return sql.begin(async (tx): Promise<DeleteColourResult> => {
    await tx`SELECT id FROM products WHERE id = ${productId} FOR UPDATE`;
    const [colour] = await tx<{ is_default: boolean }[]>`
      SELECT is_default FROM product_colors WHERE id = ${colourId} AND product_id = ${productId}`;
    if (!colour) return { ok: false, error: "Invalid colour selected." };

    const sizes = await tx<{ quantity: number }[]>`
      SELECT quantity FROM product_sizes WHERE product_id = ${productId} AND color_id = ${colourId} FOR UPDATE`;
    const stock = sizes.reduce((sum, s) => sum + Number(s.quantity), 0);
    if (stock > 0) {
      return {
        ok: false,
        error: `Cannot delete this colour because it still has ${stock} unit(s) in stock. Please use Stock Out to remove the stock first.`,
      };
    }

    const images = await tx<{ image_path: string }[]>`
      DELETE FROM product_images WHERE product_id = ${productId} AND color_id = ${colourId} RETURNING image_path`;
    await tx`DELETE FROM product_sizes WHERE product_id = ${productId} AND color_id = ${colourId}`;
    await tx`DELETE FROM product_colors WHERE id = ${colourId} AND product_id = ${productId}`;
    if (colour.is_default) {
      await tx`
        UPDATE product_colors SET is_default = TRUE
        WHERE id = (SELECT id FROM product_colors WHERE product_id = ${productId} ORDER BY id LIMIT 1)`;
    }
    return { ok: true, imagePaths: images.map((i) => i.image_path) };
  });
}

/** Records newly stored photos for a colour. The first photo of a colour becomes its main photo. */
export async function addImages(sql: Sql, productId: number, colourId: number, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await sql.begin(async (tx) => {
    await tx`SELECT id FROM product_colors WHERE id = ${colourId} AND product_id = ${productId} FOR UPDATE`;
    const [state] = await tx<{ max_sort: number; has_main: boolean }[]>`
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort, COALESCE(BOOL_OR(is_main), FALSE) AS has_main
      FROM product_images WHERE color_id = ${colourId}`;
    for (const [index, path] of paths.entries()) {
      await tx`
        INSERT INTO product_images (product_id, color_id, image_path, sort_order, is_main)
        VALUES (${productId}, ${colourId}, ${path}, ${Number(state!.max_sort) + index + 1}, ${!state!.has_main && index === 0})`;
    }
  });
}

/** Makes one photo the main photo of its colour. Returns false if it isn't this product's photo. */
export async function setMainImage(sql: Sql, productId: number, imageId: number): Promise<boolean> {
  return sql.begin(async (tx) => {
    const [image] = await tx<{ color_id: string | null }[]>`
      SELECT color_id FROM product_images WHERE id = ${imageId} AND product_id = ${productId} FOR UPDATE`;
    if (!image || image.color_id === null) return false;
    await tx`UPDATE product_images SET is_main = (id = ${imageId}) WHERE color_id = ${image.color_id} AND product_id = ${productId}`;
    return true;
  });
}

/**
 * Deletes one photo and returns its path, or null if it isn't this product's photo.
 * If it was the main photo, the colour's next photo takes over.
 */
export async function deleteImage(sql: Sql, productId: number, imageId: number): Promise<string | null> {
  return sql.begin(async (tx) => {
    const [image] = await tx<{ image_path: string; color_id: string | null; is_main: boolean }[]>`
      DELETE FROM product_images WHERE id = ${imageId} AND product_id = ${productId}
      RETURNING image_path, color_id, is_main`;
    if (!image) return null;
    if (image.is_main && image.color_id !== null) {
      await tx`
        UPDATE product_images SET is_main = TRUE
        WHERE id = (SELECT id FROM product_images WHERE color_id = ${image.color_id} ORDER BY sort_order ASC, id ASC LIMIT 1)`;
    }
    return image.image_path;
  });
}

/**
 * Of the given paths, the ones no product photo (or legacy product image) uses any more,
 * so their files can be deleted. Copies of the catalogue share paths, so this is checked.
 */
export async function unusedImagePaths(sql: Sql, paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const used = await sql<{ path: string }[]>`
    SELECT image_path AS path FROM product_images WHERE image_path IN ${sql(paths)}
    UNION
    SELECT image AS path FROM products WHERE image IN ${sql(paths)}`;
  const usedSet = new Set(used.map((u) => u.path));
  return paths.filter((p) => !usedSet.has(p));
}
