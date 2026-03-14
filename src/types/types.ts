import { MembershipRole, UserRole } from "@/generated/prisma/client";

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
  originalUrl: string;
  thumbnailUrl: string;
  key: string;
  thumbKey: string;
};

export type PresignedUpload = {
  url: string;
  key: string;
};
