import { InUseError } from "../errors/domainErrors";

/**
 * One thing that still points at the record, and the message to use when it
 * does. `count` is passed to the translation as `{count}`.
 */
export type UsageBlocker = {
  count: number;
  /** Key in the `actionErrors` namespace of messages/*.json. */
  key: string;
};

/**
 * Refuses a delete while anything still depends on the record.
 *
 * THE DATABASE IS NOT THIS GUARD, which is the whole reason the helper exists.
 * Every one of these relations is defined in a way that makes the delete
 * succeed and take something with it:
 *
 *   Category.parent    no `onDelete`, so Prisma's default for an optional
 *                      relation is SetNull - the children are silently
 *                      re-parented to the root, which reads as "my
 *                      subcategories disappeared"
 *   ProductCategory    onDelete: Cascade - the products keep existing but
 *                      quietly lose the category
 *   ProductAttributeValue,
 *   ProductVariantAttributeValue
 *                      onDelete: Cascade - every value entered on every
 *                      product for that attribute goes with it
 *   Product.brand      optional, no `onDelete` - SetNull, so the products keep
 *                      existing with their brand blanked
 *
 * None of that is recoverable from the audit log, which records the id and
 * nothing else. It happened for real on 2026-09-21: deleting the "Toys & Kids"
 * department moved its four subcategories to the top level, and the deletion
 * looked like it had eaten them.
 *
 * Checks run in the order given and the first non-empty one wins, so pass the
 * most explanatory blocker first.
 */
export function assertNotInUse(blockers: readonly UsageBlocker[]): void {
  for (const blocker of blockers) {
    if (blocker.count > 0) {
      throw new InUseError({ key: blocker.key, params: { count: blocker.count } });
    }
  }
}
