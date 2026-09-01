# Form layer

Only needed when the seller edits the field by hand. Locations verified against
`isDigital`, which is a field that goes through every one of these.

## Core eight

| # | Layer | File | Location |
|---|---|---|---|
| 1 | Zod | `src/features/products/schema/products.ts` | `createProductSchema` at 99; `isDigital` at 130. `updateProductSchema` (215) extends it, so it is inherited. |
| 2 | Server action payload type | `src/features/products/actions/products.ts` | ~56 |
| 3 | Form data type | `ProductForm.tsx` | `type ProductFormData` at 190; `isDigital` at 203 |
| 4 | Defaults, new product | `ProductForm.tsx` | ~774 |
| 5 | Defaults, edit baseline | `ProductForm.tsx` | ~814 |
| 6 | Submit payload | `ProductForm.tsx` | ~1303 |
| 7 | UI control | `ProductForm.tsx` | ~1793 (`name="isDigital"`) |
| 8 | Four locales | `messages/en.json`, `sr.json`, `de.json`, `es.json` | `productForm` namespace |

## 4 and 5 must be symmetric

The "new product" defaults (~774) and the "edit baseline" (~814) must produce
the same shape. If they diverge, the edit form opens already marked dirty - the
user sees unsaved-changes state on a form they have not touched.

This repo has hit that bug before: live stock was set through
`setValue(shouldDirty: false)` outside the baseline. The fix was to fold it into
the derived values rather than patch it in afterwards.

## Reactive controls

A control inside a `.map()` that reads ``form.watch(`arr.${i}.field`)`` does not
re-render on `setValue`. Use a top-level `useWatch`, the way `isDigital` does at
~886:

```ts
const watchedIsDigital = useWatch({ control: form.control, name: "isDigital" });
```

## Dirty indicator

`ProductForm.tsx` ~1141 groups fields into per-section change flags:

```ts
const shippingHasChanges = showChanges && !!(dirty.isDigital || dirty.requiresShipping || ...);
```

Add the new field to the flag for its section, or the section header will not
show that it changed.

## Detail page

`ProductDetails.tsx` ~186 renders the value. `isDigital` also gates a
conditional block at ~190 - check whether the new field needs the same.

## Optional layers

### Bulk edit

`src/features/products/types/bulk.ts` (line 18, `BulkFilter`) - **not**
`src/types/bulk.ts`, which does not exist.

Then `ConditionalBulkPanel.tsx`, which needs the field in several union types and
switch branches. For `isDigital` those are at 87, 105, 195, 296, 459, 464, 822,
855, 949. Grep the field you are modelling on rather than working from this list.

Server side: the where mapping in `products.ts` ~650, plus the three
`bulkUpdateByFilter` sub-places from `write-path.md`.

### CSV import

`CsvImportPanel.tsx`: column list at 34, parsing at 169, template row at 219,
help text at 350. Server side in `actions/products.ts` ~564.

The template row and the column list must stay in the same order, or every
imported column shifts by one.

### Audit log

`AuditLogView.tsx` ~207, the `columnLabels` map, plus a `columns.<field>` key in
all four `messages/*.json`. Without it the audit log shows the raw column name.
