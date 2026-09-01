# Storefront filter

Only needed when a buyer can filter the catalogue by the field.

## The chain

| # | Layer | File | Location |
|---|---|---|---|
| 1 | URL query parser | `src/lib/query/searchParams.ts` | ~20-25, alongside `minPrice`, `onSale`, `bestseller`, `isDigital` |
| 2 | Params type | `src/features/products/db/publicProducts.ts` | ~55 |
| 3 | Where clause | `publicProducts.ts` | ~191 |
| 4 | Function signature | `publicProducts.ts` | ~229 and ~246 and ~260 - the same field appears in three places in this one file |
| 5 | Facet counts | `src/features/attributes/db/facets.ts` | ~49, 228, 236, 262, 278-284 |
| 6 | Facet API | `src/app/api/facets/route.ts` | ~38 |
| 7 | Filter UI | `PublicProductsPage.tsx` | the filter panel |

Grep the field you are modelling on (`isDigital` is the complete example) rather
than trusting these numbers - the file moves.

## Facets are the fiddly part

`facets.ts` computes counts with one query per facet, each one applying **all the
other** filters but omitting its own. That is what `whereWithout({ isDigital: true })`
at ~263 does: the isDigital counts must not be filtered by isDigital, or every
option except the selected one shows zero.

A new facet needs: the count shape in the return type (~49), the `omit` union
(~228), the omission (~236), a `groupBy` (~262), the tally (~278), and the
addition to the returned object (~284).

## React Query keys - the cross-tenant trap

If the field enters a React Query key, the key on the client and the key in the
SSR prefetch must match **to the character**, or the prefetch is silently wasted
and the client refetches.

And any org-scoped key must include `orgId` from `useActiveOrgId`. Without it,
switching organisation serves the previous org's cached data. This is a real
cross-tenant leak, not a cosmetic bug.

## Price fields are special

Price filtering and sorting happen in **SQL**: `where.price.gte/lte` at ~615 and
~693 of `products.ts`, and `orderBy: { price }` with `SortField` at ~843.

So a price-like field that is computed in JS at render time will make the price
facet filter and the price sort silently disagree with the prices shown on the
cards. If the new field is a price that varies, stop and raise this with the
user before designing anything - the fix is a materialised column the database
can sort on, not a helper called at render time.
