import { Hono } from "hono";
import { storeMapLink } from "../lib/config";
import { customerSessionMiddleware } from "../lib/session";
import type { AppEnv } from "../types";
import { PublicLayout } from "../views/public/PublicLayout";

const publicRoutes = new Hono<AppEnv>();

publicRoutes.use("*", customerSessionMiddleware);

// Placeholder until the real homepage is ported in Phase 2.
publicRoutes.get("/", (c) =>
  c.html(
    <PublicLayout
      title="My Dream Bike — Premium Helmet Store"
      customer={c.var.customerSession?.user ?? null}
      flash={c.var.flash}
      mapLink={storeMapLink(c.env)}
      active="home"
    >
      <section class="container">
        <p class="section-eyebrow">Under construction</p>
        <h2 class="section-title-dark">The new My Dream Bike store is being built</h2>
        <p>Product pages arrive in Phase 2 of the rewrite.</p>
      </section>
    </PublicLayout>,
  ),
);

export default publicRoutes;
