import { MembershipRole, Prisma, UserRole } from "@/generated/prisma/client";
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
  | "order:manage";

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

export type VariantOptionValueInput = {
  name: string;
  value: string;
};

export type ProductVariantInput = {
  sku: string;
  price: number;
  compareAtPrice?: number | null;
  costPrice?: number | null;
  stock: number;
  barcode?: string;
  weight?: number | null;
  weightUnit?: string | null;
  id?: string;
  mediaKeys?: string[];
  options?: VariantOptionValueInput[];
};

export type VariantOptionTranslations = Partial<
  Record<Locale, { name?: string; values?: Record<string, string> }>
>;

export type VariantOptionInput = {
  name: string;
  values: string[];
  translations?: VariantOptionTranslations | null;
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
        translations: true;
      };
    };
    variants: {
      include: {
        optionValues: true;
        media: { include: { media: true } };
      };
    };
    options: {
      include: {
        translations: true;
        values: true;
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
    attributeValues: {
      select: {
        attributeId: true;
        optionId: true;
        valueNumeric: true;
        valueBool: true;
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
        translations: true;
      };
    };
  };
}>;

export const INVITABLE_ROLES = ["ADMIN", "MEMBER"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export type SerializedProductWithRelations = Omit<
  ProductWithRelations,
  "price" | "compareAtPrice" | "costPrice" | "variants"
> & {
  price: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  variants: (Omit<ProductWithRelations["variants"][number], "price" | "compareAtPrice" | "costPrice"> & {
    price: number;
    compareAtPrice: number | null;
    costPrice: number | null;
  })[];
};

export type SerializedProductListItem = Omit<ProductListItem, "price" | "compareAtPrice" | "costPrice"> & {
  price: number;
  compareAtPrice: number | null;
  costPrice: number | null;
};

export type ProductHistory = Prisma.ProductHistoryGetPayload<
  Record<string, never>
>;

export type SerializedProductHistory = Omit<ProductHistory, "price"> & {
  price: number;
  updatedBy: { id: string; name: string | null; email: string } | null;
};

export type PublicProduct = Prisma.ProductGetPayload<{
  include: {
    translations: true;
    media: true;
    variants: { include: { optionValues: true; media: { include: { media: true } } } };
    options: { include: { translations: true; values: true } };
    brand: {
      select: {
        id: true;
        logoUrl: true;
        translations: true;
      };
    };
  };
}>;

export type SerializedPublicProduct = Omit<
  PublicProduct,
  "price" | "compareAtPrice" | "costPrice" | "variants"
> & {
  price: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  variants: (Omit<PublicProduct["variants"][number], "price" | "compareAtPrice" | "costPrice"> & {
    price: number;
    compareAtPrice: number | null;
    costPrice: number | null;
  })[];
};

export type SerializedProductReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string | null;
    imageUrl: string | null;
  };
};
