import { renderJsonLd } from "@/lib/seo/jsonLd";

/**
 * Renders a single JSON-LD payload as an inline `<script>` tag.
 *
 * Server-only by design: `JSON.stringify` runs on the server and the
 * output is embedded verbatim in the HTML stream, so crawlers see it
 * without executing client JS. Multiple schemas should each get their
 * own `<JsonLdScript>` rather than being merged into an `@graph` block -
 * Google Rich Results parses both, separate scripts are easier to debug
 * with the schema validator.
 */
export function JsonLdScript({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: renderJsonLd(data) }}
    />
  );
}
