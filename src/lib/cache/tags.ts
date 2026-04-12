export const CacheTags = {
  users: {
    all: () => "global:users" as const,
    byId: (id: string) => `id:users:${id}` as const,
    byClerkId: (clerkId: string) => `id:users:clerk:${clerkId}` as const,
  },
  organizations: {
    all: () => "global:organizations" as const,
    byId: (id: string) => `id:organizations:${id}` as const,
    members: (orgId: string) => `id:organizations:${orgId}:members` as const,
    invites: (orgId: string) => `id:organizations:${orgId}:invites` as const,
  },
  products: {
    all: (orgId: string) => `global:products:${orgId}` as const,
    byId: (orgId: string, id: string) => `id:products:${orgId}:${id}` as const,
    history: (orgId: string, id: string) =>
      `id:products:${orgId}:${id}:history` as const,
    publicAll: () => "global:products:public" as const,
    publicById: (id: string) => `id:products:public:${id}` as const,
  },
  orders: {
    byUser: (userId: string) => `id:orders:user:${userId}` as const,
    byId: (id: string) => `id:orders:${id}` as const,
  },
  reviews: {
    byProduct: (productId: string) =>
      `id:reviews:product:${productId}` as const,
    userReview: (productId: string, userId: string) =>
      `id:reviews:product:${productId}:user:${userId}` as const,
  },
} as const;
