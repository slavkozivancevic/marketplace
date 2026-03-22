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
  stock: number;
  id?: string;
  options?: VariantOptionValueInput[];
};

export type VariantOptionInput = {
  name: string;
  values: string[];
};

// export type ProductCreateInput = {
//   title: string;
//   description: string;
//   price: number;
//   images?: ImageInput[];
//   variants?: ProductVariantInput[];
//   options?: VariantOptionInput[];
//   status?: ProductStatus;
// };

// export type ProductUpdateInput = Partial<ProductCreateInput> & {
//   version: number;
// };

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
