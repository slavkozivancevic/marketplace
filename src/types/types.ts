import type { MoneySet } from "@/lib/money";
import { MembershipRole, Prisma, ReviewStatus, UserRole } from "@/generated/prisma/client";
import type { Locale } from "@/i18n/config";

export type RequestContext = {
  clerkUserId: string;

  userId: string;
  userRole: UserRole;

  organizationId: string;
  membershipRole: MembershipRole;

  organizationVerified: boolean;
};

export type Permission =
  | "product:create"
  | "product:update"
  | "product:delete"
  | "product:read"
  | "order:read"
  | "order:manage"
  | "payout:manage";

import type { MediaType } from "@/generated/prisma/client";

export type MediaInput = {
  key: string;
  mediaType: MediaType;
  thumbKey?: string | null;
  mimeType?: string | null;
  durationMs?: number | null;
  width?: number | null;
  height?: number | null;
};

// Single-field input used by the synchronous image/video processor pipelines -
// they only need the S3 key to fetch the original object back.
export type ImageInput = {
  key: string;
};

// A single variant axis selection: which AttributeOption this variant has for
// a variant-defining attribute (e.g. attribute "color" -> option "red").
export type VariantAttributeValueInput = {
  attributeId: string;
  optionId: string;
};

export type ProductVariantInput = {
  sku: string;
  // MoneySets, resolved by the action from what the seller typed. The repo
  // writes each one alongside its USD-cent mirror column.
  price: MoneySet;
  compareAtPrice?: MoneySet | null;
  costPrice?: MoneySet | null;
  stock: number;
  barcode?: string;
  weight?: number | null;
  weightUnit?: string | null;
  id?: string;
  mediaKeys?: string[];
  // The variant's value on each axis (variant-defining attribute).
  options?: VariantAttributeValueInput[];
};

export type ProductTranslationsInput = Partial<
  Record<
    Locale,
    {
      title?: string;
      // Per-locale URL slug. Optional - omitted/empty, the repo derives it
      // from `slugify(translatedTitle)`.
      slug?: string;
      description?: string;
      shortDescription?: string;
      metaTitle?: string;
      metaDescription?: string;
    }
  >
>;

export type ImageProcessingResult = {
  key: string;
  thumbKey: string;
  originalDownloadUrl: string;
  thumbnailDownloadUrl: string;
  width?: number;
  height?: number;
  error?: boolean;
};

export type VideoProcessingResult = {
  key: string;
  thumbKey: string;
  videoDownloadUrl: string;
  posterDownloadUrl: string;
  mimeType: string;
  durationMs: number;
  width: number;
  height: number;
  error?: boolean;
};

export type PresignedUploadedMedia = {
  key: string;
  url: string;

  mediaType: MediaType;
  mimeType?: string;

  // Stable client-side identifier used as React key and dnd-kit id.
  // Survives the temp→processed key swap so the DOM element isn't remounted
  // when the blob URL is replaced with the S3 URL.
  clientId?: string;

  // Image: full-resolution download URL. Video: same as url (source video URL).
  downloadUrl?: string;

  // Video only: server-extracted poster frame (used as thumbnail in grids).
  posterUrl?: string;
  thumbKey?: string;
  durationMs?: number;
  width?: number;
  height?: number;

  progress?: number;
  error?: boolean;
};

// Back-compat alias for code still typing against the old shape.
export type PresignedUploadedImage = PresignedUploadedMedia;

export type CreateProductMediaUploadResponse = {
  error: boolean;
  message?: string;
  data: {
    key: string;
    url: string;
  };
};

export type ProcessProductImageResponse = {
  error: boolean;
  message?: string;
  data: ImageProcessingResult;
};

export type ProcessProductVideoResponse = {
  error: boolean;
  message?: string;
  data: VideoProcessingResult;
};

// Back-compat alias
export type CreateProductImageUploadResponse = CreateProductMediaUploadResponse;

export type ActionErrorResult = {
  error: boolean;
  message: string;
};

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    translations: true;
    media: true;
    brand: {
      select: {
        id: true;
        logoUrl: true;
        logoUrlDark: true;
        logoBackdrop: true;
        logoBackdropDark: true;
        translations: true;
      };
    };
    variants: {
      include: {
        attributeValues: {
          include: {
            attribute: { select: { id: true; key: true; type: true; translations: true } };
            option: { select: { id: true; value: true; translations: true } };
          };
        };
        media: { include: { media: true } };
      };
    };
    categories: {
      include: {
        category: {
          select: {
            id: true;
            parentId: true;
            translations: true;
          };
        };
      };
    };
    tags: {
      include: {
        tag: {
          select: {
            id: true;
            translations: true;
          };
        };
      };
    };
    attributeValues: {
      include: {
        attribute: {
          select: {
            id: true;
            key: true;
            type: true;
            unit: true;
            order: true;
            translations: true;
          };
        };
        option: { select: { id: true; value: true; order: true; translations: true } };
      };
    };
  };
}>;

export type ProductListItem = Prisma.ProductGetPayload<{
  include: {
    translations: true;
    media: true;
    brand: {
      select: {
        id: true;
        logoUrl: true;
        logoUrlDark: true;
        logoBackdrop: true;
        logoBackdropDark: true;
        translations: true;
      };
    };
  };
}>;

/**
 * Admin/seller product list row - same shape as the public-facing
 * `ProductListItem`, plus the creator. Kept as a separate type (rather than
 * adding `createdBy` to `ProductListItem` itself) because that type is also
 * used by the public storefront's product queries (search, wishlist, related
 * products), which have no business exposing who on the seller's team
 * created a listing.
 */
export type AdminProductListItem = Prisma.ProductGetPayload<{
  include: {
    translations: true;
    media: true;
    brand: {
      select: {
        id: true;
        logoUrl: true;
        logoUrlDark: true;
        logoBackdrop: true;
        logoBackdropDark: true;
        translations: true;
      };
    };
    createdBy: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
  };
}>;

export const INVITABLE_ROLES = ["ADMIN", "MEMBER"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

/** Option shape for org-member pickers (e.g. the "Created by" product filter). */
export type MemberOption = { id: string; name: string | null; email: string };

/**
 * Swaps a row's raw money columns for the pair the UI actually uses: the parsed
 * `MoneySet` (what to display, per currency) plus the USD-cent mirror (what
 * sorting, price filters and thresholds compare). The raw `Json` columns never
 * escape the db layer.
 */
export type WithMoney<T> = Omit<
  T,
  | "price"
  | "compareAtPrice"
  | "costPrice"
  | "priceMoney"
  | "compareAtPriceMoney"
  | "costPriceMoney"
> & {
  price: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  priceMoney: MoneySet | null;
  compareAtPriceMoney: MoneySet | null;
  costPriceMoney: MoneySet | null;
};

export type SerializedProductWithRelations = WithMoney<
  Omit<ProductWithRelations, "variants">
> & {
  variants: WithMoney<ProductWithRelations["variants"][number]>[];
};

export type SerializedProductListItem = WithMoney<ProductListItem>;

export type SerializedAdminProductListItem = WithMoney<AdminProductListItem>;

export type ProductHistory = Prisma.ProductHistoryGetPayload<
  Record<string, never>
>;

export type SerializedProductHistory = Omit<ProductHistory, "price" | "priceMoney"> & {
  price: number;
  /** The set as it stood at this version, so history renders each entry in the
   *  currency it was actually priced in rather than reconverting today. */
  priceMoney: MoneySet | null;
  updatedBy: { id: string; name: string | null; email: string } | null;
};

// Raw DB payload for a public product under the unified model: variant axis
// values live on `variants[].attributeValues` (controlled vocabulary). The
// storefront serialization below projects these into a back-compat
// `options` + `variants[].optionValues` shape so the existing detail / cart /
// purchase UI keeps working unchanged.
// Kept in sync by hand with `publicProductInclude` in
// features/products/db/variantCompat.ts - this is a literal, not a derivation
// of it, so a field added there must be added here too.
export type PublicProductRaw = Prisma.ProductGetPayload<{
  include: {
    translations: true;
    media: true;
    attributeValues: {
      include: {
        attribute: {
          select: {
            id: true;
            key: true;
            type: true;
            unit: true;
            order: true;
            translations: true;
          };
        };
        option: { select: { id: true; value: true; order: true; translations: true } };
      };
    };
    variants: {
      include: {
        attributeValues: {
          include: {
            attribute: { select: { id: true; key: true; order: true; translations: true } };
            option: { select: { id: true; value: true; order: true; translations: true } };
          };
        };
        media: { include: { media: true } };
      };
    };
    brand: { select: { id: true; logoUrl: true; logoUrlDark: true; logoBackdrop: true; logoBackdropDark: true; translations: true } };
    tags: { include: { tag: { select: { id: true; translations: true } } } };
  };
}>;

// ----- Back-compat projected shape consumed by the storefront UI -----

export type CompatOptionTranslation = {
  locale: string;
  name: string;
  // Map of option value (slug) -> localized label, e.g. { red: "Crvena" }.
  values: Record<string, string>;
};
export type CompatProductOption = {
  id: string; // attributeId
  translations: CompatOptionTranslation[];
  // Distinct option values used by this product for this axis (mirrors the
  // legacy VariantOptionValue[] shape the selector UI iterates over).
  values: { value: string }[];
};
export type CompatVariantOptionValue = {
  id: string;
  optionId: string; // attributeId
  value: string; // option value (slug)
};

type PublicVariantBase = Omit<
  WithMoney<PublicProductRaw["variants"][number]>,
  "attributeValues"
>;

export type SerializedPublicProduct = WithMoney<
  Omit<PublicProductRaw, "variants">
> & {
  options: CompatProductOption[];
  variants: (PublicVariantBase & {
    optionValues: CompatVariantOptionValue[];
  })[];
};

/** @deprecated kept as alias; use PublicProductRaw / SerializedPublicProduct. */
export type PublicProduct = PublicProductRaw;

export type SerializedProductReview = {
  id: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  moderationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  editedAt: Date | null;
  user: {
    id: string;
    name: string | null;
    imageUrl: string | null;
  };
};
