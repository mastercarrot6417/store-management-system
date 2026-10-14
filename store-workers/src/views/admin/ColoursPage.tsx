import type { ColourCard, ColourPageData } from "../../lib/admin/colours";
import { MAX_COLOUR_NAME } from "../../lib/admin/colours";
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_UPLOAD } from "../../lib/images";
import { CsrfField } from "../../lib/csrf";
import { imageUrl } from "../../lib/format";

/** Colours & Images for one product, ported from admin/manage_product_colors.php. Photos go to R2. */
export function ColoursPage({ data, csrfToken }: { data: ColourPageData; csrfToken: string }) {
  const { product, colours } = data;
  const base = `/admin/products/${product.id}/colours`;

  return (
    <div class="mpc-page">
      <div class="mpc-topbar">
        <div>
          <span class="mpc-kicker">Admin · Colours &amp; Images</span>
          <h2 class="mpc-title">{product.name}</h2>
          <div class="mpc-meta">
            <span class="mpc-pill">Item Code: {product.itemCode}</span>
            <span class="mpc-pill">{product.category} / {product.subCategory}</span>
            {product.brand && <span class="mpc-pill">{product.brand}</span>}
            {product.archived && <span class="mpc-pill mpc-pill-archived">Archived</span>}
          </div>
        </div>
        <div class="mpc-toolbar">
          {colours.length > 0 && (
            <button type="submit" form="bulkSaveForm" class="mpc-btn mpc-btn-primary">💾 Save Changes</button>
          )}
          <a href={`/admin/products/${product.id}/edit`} class="mpc-btn mpc-btn-ghost">← Back to Edit Product</a>
        </div>
      </div>

      <div class="mpc-layout">
        <aside>
          <div class="mpc-panel">
            <h3>Add New Colour</h3>
            <form method="post" action={`${base}/add`}>
              <CsrfField token={csrfToken} />
              <div class="mpc-field">
                <label class="mpc-label" for="new_color_name">Colour Name</label>
                <input class="mpc-input" type="text" id="new_color_name" name="color_name" maxlength={MAX_COLOUR_NAME} placeholder="e.g. Matte Black" required />
              </div>
              <div class="mpc-field">
                <label class="mpc-label" for="new_color_code">Colour Code</label>
                <div class="mpc-color-picker-wrap">
                  <input class="mpc-color-input js-colour-sync" type="color" id="new_color_code_picker" value="#1a1a1a" data-target="new_color_code" />
                  <input class="mpc-input" type="text" id="new_color_code" name="color_code" value="#1a1a1a" pattern="#[0-9A-Fa-f]{6}" maxlength={7} required />
                </div>
              </div>
              <div class="mpc-field">
                <label class="mpc-check"><input type="checkbox" name="is_default" value="1" /> Set as default colour</label>
              </div>
              <button type="submit" class="mpc-btn mpc-btn-primary mpc-btn-block">Add Colour</button>
            </form>
          </div>
          <div class="mpc-panel mpc-panel-tips">
            <h3>Photo tips</h3>
            <ul class="mpc-tip-list">
              <li>JPEG, PNG, GIF or WebP, up to {MAX_IMAGE_BYTES / 1024 / 1024} MB each.</li>
              <li>Up to {MAX_IMAGES_PER_UPLOAD} photos at a time.</li>
              <li>The main photo is shown first in the shop.</li>
            </ul>
          </div>
        </aside>

        <section class="mpc-main">
          <form id="bulkSaveForm" method="post" action={`${base}/save`}>
            <CsrfField token={csrfToken} />
          </form>

          {colours.length === 0 ? (
            <div class="mpc-empty">
              <h3>No colours added yet</h3>
              <p>Add your first colour from the left panel to start managing images.</p>
            </div>
          ) : (
            <div class="mpc-cards">
              {colours.map((colour) => (
                <ColourCardView colour={colour} base={base} csrfToken={csrfToken} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ColourCardView({ colour, base, csrfToken }: { colour: ColourCard; base: string; csrfToken: string }) {
  const id = colour.id;
  const photos = colour.images.length;
  return (
    <article class="mpc-card">
      <div class="mpc-card-head">
        <div class="mpc-card-title-wrap">
          <div class="mpc-swatch" style={`background: ${colour.code};`}></div>
          <div>
            <h2 class="mpc-card-title">{colour.name}</h2>
            <div class="mpc-card-sub">
              {photos} image{photos === 1 ? "" : "s"} in this colour · {colour.stock} unit{colour.stock === 1 ? "" : "s"} in stock
            </div>
            {colour.isDefault && <div class="mpc-default-badge">★ Current default colour</div>}
          </div>
        </div>
        <div class="mpc-card-actions">
          {colour.stock > 0 ? (
            <button type="button" class="mpc-btn mpc-btn-danger" disabled title="Stock Out this colour before deleting it.">🗑 Delete Colour</button>
          ) : (
            <form
              method="post"
              action={`${base}/${id}/delete`}
              class="admin-confirm-form"
              data-confirm-title="Delete Colour"
              data-confirm-message="Are you sure you want to delete this colour and its images? This action cannot be undone."
              data-confirm-text="Yes, Delete"
              data-confirm-type="danger"
            >
              <CsrfField token={csrfToken} />
              <button type="submit" class="mpc-btn mpc-btn-danger">🗑 Delete Colour</button>
            </form>
          )}
        </div>
      </div>

      <div class="mpc-card-body">
        <div class="mpc-edit-grid">
          <input type="hidden" name="color_ids[]" value={String(id)} form="bulkSaveForm" />
          <div class="mpc-field">
            <label class="mpc-label" for={`color_name_${id}`}>Colour Name</label>
            <input class="mpc-input" type="text" id={`color_name_${id}`} name={`color_name_${id}`} value={colour.name} maxlength={MAX_COLOUR_NAME} form="bulkSaveForm" required />
          </div>
          <div class="mpc-field">
            <label class="mpc-label" for={`color_code_${id}`}>Colour Code</label>
            <div class="mpc-color-picker-wrap">
              <input class="mpc-color-input js-colour-sync" type="color" value={colour.code} data-target={`color_code_${id}`} aria-label="Pick colour" />
              <input class="mpc-input" type="text" id={`color_code_${id}`} name={`color_code_${id}`} value={colour.code} pattern="#[0-9A-Fa-f]{6}" maxlength={7} form="bulkSaveForm" required />
            </div>
          </div>
          <div class="mpc-default-row">
            <input type="radio" id={`default_color_${id}`} name="default_color_id" value={String(id)} checked={colour.isDefault} form="bulkSaveForm" />
            <label for={`default_color_${id}`}>Use this as the default colour</label>
          </div>
        </div>

        <div class="mpc-images">
          <div class="mpc-image-grid">
            {colour.images.map((img) => (
              <div class="mpc-image-tile">
                <div class="mpc-image-preview">
                  <img src={imageUrl(img.path) ?? ""} alt={`${colour.name} image`} loading="lazy" data-fallback-class="mpc-image-missing" data-fallback-text="Image missing" />
                  {img.isMain && <div class="mpc-main-image-badge">★ Main image</div>}
                </div>
                <div class="mpc-image-actions">
                  {img.isMain ? (
                    <button type="button" class="mpc-mini-btn" disabled>Main Image</button>
                  ) : (
                    <form method="post" action={`${base}/images/${img.id}/main`}>
                      <CsrfField token={csrfToken} />
                      <button type="submit" class="mpc-mini-btn">Set Main</button>
                    </form>
                  )}
                  <form
                    method="post"
                    action={`${base}/images/${img.id}/delete`}
                    class="admin-confirm-form"
                    data-confirm-title="Delete Image"
                    data-confirm-message="Are you sure you want to delete this image? This action cannot be undone."
                    data-confirm-text="Yes, Delete"
                    data-confirm-type="danger"
                  >
                    <CsrfField token={csrfToken} />
                    <button type="submit" class="mpc-mini-btn mpc-mini-btn-danger">Delete</button>
                  </form>
                </div>
              </div>
            ))}

            <div class="mpc-upload-tile">
              <strong>+ Add Images</strong>
              <p>Upload more files for {colour.name}.</p>
              <form method="post" enctype="multipart/form-data" action={`${base}/${id}/images`} class="js-upload-form">
                <CsrfField token={csrfToken} />
                <input class="mpc-upload-input" type="file" id={`upload_${id}`} name="images[]" accept="image/jpeg,image/png,image/gif,image/webp" multiple required />
                <label for={`upload_${id}`} class="mpc-btn mpc-btn-ghost">Choose Files</label>
                <noscript><button type="submit" class="mpc-btn mpc-btn-primary">Upload</button></noscript>
              </form>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
