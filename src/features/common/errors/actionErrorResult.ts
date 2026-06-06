/**
 * Tiny client-safe predicate. Lives in its own file so client components can
 * import it without dragging in the rest of `domainErrors.ts`, which imports
 * the Prisma client - Prisma's runtime references `node:module`, which
 * Turbopack cannot bundle into a Client Component chunk.
 */
export function isActionErrorResult(
  result: unknown,
): result is { error: true; message: string } {
  return (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    (result as { error: unknown }).error === true
  );
}
