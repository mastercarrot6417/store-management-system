import type { Child } from "hono/jsx";
import type { Flash } from "../../lib/flash";
import type { CustomerUser } from "../../lib/session";
import { Document } from "../Document";
import { Footer } from "./Footer";
import { MobileMenu } from "./MobileMenu";
import { Navbar, type ActiveNav } from "./Navbar";

type PublicLayoutProps = {
  title: string;
  description?: string;
  customer: CustomerUser | null;
  flash: Flash | null;
  mapLink: string;
  active?: ActiveNav;
  search?: string;
  extraStylesheets?: string[];
  children: Child;
};

/** Page frame for the public shop: navbar, mobile menu, flash message, footer. */
export function PublicLayout(props: PublicLayoutProps) {
  return (
    <Document
      title={props.title}
      description={props.description ?? "My Dream Bike — Premium motorcycle helmets, riding apparel, and accessories."}
      fonts="public"
      bodyClass="public-page"
      stylesheets={["/assets/css/style.css", ...(props.extraStylesheets ?? [])]}
      scripts={["/assets/js/app.js"]}
    >
      <Navbar active={props.active ?? null} search={props.search ?? ""} isLoggedIn={props.customer !== null} />
      <MobileMenu isLoggedIn={props.customer !== null} customerName={props.customer?.fullName ?? ""} />

      {props.flash && (
        <div class={`flash ${props.flash.kind === "success" ? "flash-success" : "flash-danger"}`}>{props.flash.message}</div>
      )}

      {props.children}

      <Footer mapLink={props.mapLink} />
    </Document>
  );
}
