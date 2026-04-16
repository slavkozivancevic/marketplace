import { MembershipRole, Prisma, UserRole } from "@/generated/prisma/client";

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
  | "product:read";

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
  imageKeys?: string[];
  options?: VariantOptionValueInput[];
};

export type VariantOptionInput = {
  name: string;
  values: string[];
};

export type ImageProcessingResult = {
  key: string;
  thumbKey: string;
  originalDownloadUrl: string;
  thumbnailDownloadUrl: string;
  error?: boolean;
};

export type PresignedUploadedImage = {
  key: string;
  url: string;

  downloadUrl?: string;

  progress?: number;
  error?: boolean;
};

export type CreateProductImageUploadResponse = {
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

export type ActionErrorResult = {
  error: boolean;
  message: string;
};

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    images: true;
    variants: {
      include: {
        optionValues: true;
        images: true;
      };
    };
    options: {
      include: {
        values: true;
      };
    };
  };
}>;

export type ProductListItem = Prisma.ProductGetPayload<{
  include: {
    images: true;
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
    images: true;
    variants: { include: { optionValues: true; images: true } };
    options: { include: { values: true } };
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
