import type { Context } from "hono";
import type { Child } from "hono/jsx";
import { storeMapLink } from "../lib/config";
import type { AppEnv } from "../types";
import { PublicLayout } from "../views/public/PublicLayout";

export type LayoutOptions = {
  title: string;
  description?: string;
  active?: string | null;
  search?: string;
  bodyClass?: string;
  extraStylesheets?: string[];
  extraScripts?: string[];
};

/** Renders a page inside the public layout with the visitor's login state and flash message. */
export function renderPublic(c: Context<AppEnv>, options: LayoutOptions, content: Child, status: 200 | 400 = 200) {
  return c.html(
    <PublicLayout
      {...options}
      customer={c.var.customerSession?.user ?? null}
      flash={c.var.flash}
      mapLink={storeMapLink(c.env)}
    >
      {content}
    </PublicLayout>,
    status,
  );
}

/** Reads a text form field, trimmed. Anything that isn't a string (e.g. a file) counts as empty. */
export function formText(body: Record<string, unknown>, name: string, maxLength = 1000): string {
  const value = body[name];
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
