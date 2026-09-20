/**
 * One line of a return: the product, with its variant quieter underneath.
 *
 * The same two-line shape the order item tables, the invoice PDF and every
 * email use. The return cards were the last place putting the variant in
 * brackets after the name ("Trionda (Bela) × 1"), which is the one form that
 * cannot be styled, wrapped or read apart from the product's own name.
 *
 * The two lines carry their own contrast rather than inheriting the list's.
 * These cards render the whole list in small muted text, so a variant set in
 * the same ink directly under the name read as a SECOND returned item called
 * "Bela". The name takes the foreground and the variant stays muted, which is
 * the same thing that makes it read correctly in the emails, where the name is
 * the darker of the two.
 *
 * The quantity rides on the LAST line - the variant when there is one, the name
 * otherwise. Nowhere else in the app does it sit against the product name: the
 * order pages hang it off the price line below the variant, and the emails and
 * the invoice give it a column of its own. A line of its own would leave "× 1"
 * orphaned, and an item with no variant would have nothing to orphan it under.
 * On the variant it also reads the way it is said - one white one.
 *
 * `quantity` is left out where a control already states it - the request form
 * has a stepper next to each line.
 */
export function ReturnItemLine({
  title,
  variantLabel,
  quantity,
  className,
}: {
  title: string;
  variantLabel: string | null;
  quantity?: number;
  className?: string;
}) {
  const qty = quantity != null ? ` × ${quantity}` : "";
  return (
    <div className={className}>
      <span className="block truncate text-foreground">
        {title}
        {variantLabel ? "" : qty}
      </span>
      {variantLabel && (
        <span className="block truncate text-muted-foreground">
          {variantLabel}
          {qty}
        </span>
      )}
    </div>
  );
}
