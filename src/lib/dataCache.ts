type CACHE_TAG = "users" | "products" | "organizations" | string;

export function getGlobalTag(scope: CACHE_TAG) {
  return `global:${scope}` as const;
}

export function getIdTag(scope: CACHE_TAG, id: string) {
  return `id:${scope}:${id}` as const;
}
