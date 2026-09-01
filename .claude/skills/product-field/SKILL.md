---
name: product-field
description: Add, remove or rename a field on the Product model and thread it through every layer that must know about it. Use whenever a task involves a new or changed Product column - a flag, an attribute, a price-like number, a seller-editable setting, a storefront filter, or an internal computed field. Also use when asked "what do I need to update if I add X to Product". Covers Prisma schema, the write path in productRepository, Zod schemas, ProductForm, four-locale copy, bulk edit, CSV import, audit log labels, storefront filters and facets.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(npm run typecheck), Bash(npm run lint), Bash(npm test *)
---

# Adding a field to Product

The read types are free. **The write path is not** - it is explicit in five
separate places, and `typecheck` catches only some of them.

Work through this in order. Do not skip to editing.

## 1. Classify the field first

The answer changes the whole scope. Ask the user if it is not stated.

| Kind | Example | Scope |
|---|---|---|
| **Internal / computed** | `isBestseller` | schema + writer + read site. **No form.** Cheapest by far - suggest it if manual editing is not actually required. |
| **Seller-editable** | `isDigital` | everything in sections 2, 3 and 4 |
| **Storefront-filterable** | `isDigital` | the above, plus section 5 |

## 2. Schema (always)

`prisma/schema.prisma`, model `Product` (lines 304-378). It is grouped into
sections: Pricing, Shipping, Inventory, Digital, Relations, Timestamps. Put the
field in the matching one, with a comment explaining why it exists if that is
not obvious. Add `@@index` only if it will be filtered on.

**Then STOP.** Report the schema change and wait - the user runs the migration,
never you. This is a hard rule from CLAUDE.md and it is enforced by a hook.

## 3. Read types - usually nothing to do

`src/types/types.ts` and `src/features/products/db/publicProducts.ts` use
`Prisma.ProductGetPayload<{ include: ... }>`, not `select`. A new scalar appears
automatically in `ProductListItem`, `AdminProductListItem`,
`SerializedProductListItem`, `PublicProductRaw` and on `<ProductCard>`.

This is the only layer that is free. Everything below is explicit.

## 4. The write path (always) - see `references/write-path.md`

Five hand-maintained places in `src/features/products/db/products.ts`. Read that
reference file before editing; the `duplicate` and bulk cases are the ones that
get missed, and only one of the five is caught by `typecheck`.

## 5. Form layer, if the seller edits it - see `references/form-layer.md`

Eight layers from Zod through to the four locale files. The reference lists each
one with its verified location.

## 6. Storefront filter, if it is filterable - see `references/storefront.md`

Query params, the public where clause, facet counts, and the filter UI. Note the
React Query key must match the SSR prefetch exactly or the prefetch is wasted.

## 7. Verify

```
npm run typecheck
npm run lint
npm test
```

`typecheck` catches most of the write path because the payload types are
explicit. It does **not** catch:

- a forgotten `duplicate` case (the field is silently dropped on copy)
- a forgotten branch in `onlyStockChange` / `hasNonStockScalarUpdate` (bulk edit
  silently does not persist)
- a missing `de` or `es` translation (renders the raw key)

Check those three by reading, not by trusting the compiler.

## Rules that always apply

- Never run `prisma migrate`. Stop after the schema change.
- Every user-facing string ships in all four locales: `messages/en|sr|de|es.json`.
- Form conventions: `mode: "onChange"`, Save disabled while there are errors,
  `noValidate`, asterisk on required labels only. Reference: `CouponForm.tsx`.
- Grep for every identifier before you cite it. Do not reconstruct names or line
  numbers from memory.
