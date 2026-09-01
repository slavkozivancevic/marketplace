# The write path

All in `src/features/products/db/products.ts`. The file exports only two things:

```
424:  export async function refreshProductSearchText(...)
835:  export function productRepository(ctx)
```

There is no `createProduct`, `updateProduct` or `duplicateProduct` function.
Everything below is a **method on the repository object** returned by
`productRepository(ctx)`. Grep for `async create(`, not `createProduct`.

## The five places

| # | Method | Where | What to add | Caught by typecheck |
|---|---|---|---|---|
| 1 | `create` | ~1009 | field in the inline payload type | yes |
| 2 | `create` | ~1049 | field in the `data:` block passed to Prisma | yes |
| 3 | `update` | ~1161 | field in the inline payload type | yes |
| 4 | `duplicate` | ~1672-1700 | field in the `this.create({ ... })` call | **NO** |
| 5 | `bulkUpdateByFilter` | ~1811 | three sub-places, see below | **NO** |

## 4. `duplicate` is the one that gets missed

`async duplicate(id)` at ~1556 copies the source product **field by field** into
`this.create({ ... })` around lines 1672-1700:

```ts
price: source.price,
compareAtPrice: source.compareAtPrice ?? undefined,
taxable: source.taxable,
requiresShipping: source.requiresShipping,
isDigital: source.isDigital,
```

A field left out here compiles fine and is **silently dropped on every
duplicate**. There is no error, no warning; the copy just quietly has the
default value.

## 5. `bulkUpdateByFilter` needs three edits, not one

`async bulkUpdateByFilter(...)` at ~1811:

1. **Destructuring** of the incoming update object.
2. **`scalarUpdates`** at ~1856 - the guarded assignment block:
   ```ts
   if (isDigital !== undefined) scalarUpdates.isDigital = isDigital;
   ```
3. **`onlyStockChange`** at ~1870 and the related
   `hasNonStockScalarUpdate` condition. These decide whether a `ProductHistory`
   row is written and whether the update is treated as a real change.

Miss #3 and the bulk edit **silently does not persist**. This is the single most
expensive omission in the whole checklist, because it looks like it worked.

## ProductHistory

`ProductHistory` (schema line 415) snapshots only `title`, `description`,
`price`, `status` and `translationsSnap`. If the new field must be versioned,
that is a separate column on `ProductHistory` plus edits at **four**
`productHistory.create` call sites:

```
1120  create()
1333  update()
1527  bulkUpdateStatus()
2014  bulkUpdateByFilter()
```

Count them yourself before editing - an earlier pass over this file reported
three and missed the one in `bulkUpdateStatus`.

## Search text

`refreshProductSearchText` (line 424) builds the searchable text blob. If the
new field is text that should be findable by search, it belongs there too.

## Cache

`src/features/products/db/cache.ts` holds `revalidateProductCache`. It does not
need to know about a new column. But if you add a **new read route** for the
field, that route needs `use cache` + `cacheTag` + **both** `revalidateTag` and
`updateTag`. Only calling `revalidateTag` serves stale data until a hard reload -
this was a real bug in this repo.
