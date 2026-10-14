import { PublicLayout } from "./public/PublicLayout";

type ErrorPageProps = {
  status: number;
  title: string;
  message: string;
  mapLink: string;
};

/**
 * Shown for 403/404/500. Uses no database data, so it still renders when the
 * database is the thing that failed.
 */
export function ErrorPage({ status, title, message, mapLink }: ErrorPageProps) {
  return (
    <PublicLayout title={`${title} - My Dream Bike`} customer={null} flash={null} mapLink={mapLink}>
      <section class="container">
        <p class="section-eyebrow">Error {status}</p>
        <h2 class="section-title-dark">{title}</h2>
        <p>{message}</p>
        <p><a href="/" class="btn-hero-primary">Back to the shop</a></p>
      </section>
    </PublicLayout>
  );
}
