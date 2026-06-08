"use client";

import type { ComponentProps } from "react";
import { ProductForm } from "./ProductForm";
import { useNavigationGeneration } from "@/lib/navigation/navGeneration";

/**
 * Client wrapper that remounts {@link ProductForm} whenever the user navigates.
 *
 * Next's client Router Cache can restore this page's form subtree on return with
 * the user's unsaved edits still in it (no remount, no prop change), making a
 * half-edited form reopen as if it were the saved record. Keying the form on the
 * navigation-generation counter forces a fresh mount - and thus server values -
 * on return. The counter is stable while you stay on the page, so editing is
 * never interrupted; a language switch is a full reload, so it starts at 0 and
 * the in-form draft restore is unaffected.
 *
 * The product id is part of the key too, preserving the existing "remount when
 * switching products" behavior. `router.refresh()` doesn't change the pathname,
 * so it doesn't bump the counter - no refresh/remount loop.
 */
export function ProductFormView(props: ComponentProps<typeof ProductForm>) {
  const navGeneration = useNavigationGeneration();
  const idPart =
    props.mode === "update" && props.product ? props.product.id : "new";
  return <ProductForm key={`${idPart}:${navGeneration}`} {...props} />;
}
