import type { Child } from "hono/jsx";
import { raw } from "hono/html";

/** Bump when CSS/JS in public/ changes, so browsers fetch the new files. */
const ASSET_VERSION = "5";

export function asset(path: string): string {
  return `${path}?v=${ASSET_VERSION}`;
}

const FONTS = {
  public: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;600&display=swap",
  admin: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
};

type DocumentProps = {
  title: string;
  description?: string;
  fonts: keyof typeof FONTS;
  bodyClass?: string;
  stylesheets: string[];
  scripts?: string[];
  children: Child;
};

/** The <html> shell shared by every page. */
export function Document(props: DocumentProps) {
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          {props.description && <meta name="description" content={props.description} />}
          <title>{props.title}</title>
          <link rel="icon" type="image/png" href="/company_logo/ori.logo.png" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
          <link href={FONTS[props.fonts]} rel="stylesheet" />
          {props.stylesheets.map((href) => (
            <link rel="stylesheet" href={asset(href)} />
          ))}
        </head>
        <body class={props.bodyClass}>
          {props.children}
          {(props.scripts ?? []).map((src) => (
            <script src={asset(src)}></script>
          ))}
        </body>
      </html>
    </>
  );
}
