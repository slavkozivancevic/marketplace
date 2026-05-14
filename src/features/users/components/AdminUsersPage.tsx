"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { SearchInput } from "@/components/search/SearchInput";
import {
  FilterSidebar,
  type FilterGroup,
  type FilterValues,
} from "@/components/search/FilterSidebar";
import { ActiveFilters } from "@/components/search/ActiveFilters";
import { MobileFilterSheet } from "@/components/search/FilterSidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UserForm } from "./UserForm";
import { Badge } from "@/components/ui/badge";
import { type UserRole } from "@/features/users/schema/users";

interface SerializedUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  imageUrl: string | null;
  createdAt: string;
  memberships: {
    orgId: string;
    role: string;
    organization: { id: string; name: string; verified: boolean };
  }[];
}

export function AdminUsersPage({ users }: { users: SerializedUser[] }) {
  const t = useTranslations();

  const FILTER_GROUPS: FilterGroup[] = [
    {
      type: "checkbox",
      key: "role",
      label: t("users.role"),
      options: [
        { value: "USER", label: t("users.user") },
        { value: "SELLER", label: t("users.seller") },
        { value: "ADMIN", label: t("users.admin") },
      ],
    },
  ];

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string[]>([]);

  const filtered = useMemo(() => {
    let result = users;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
    }

    if (roleFilter.length > 0) {
      result = result.filter((u) => roleFilter.includes(u.role));
    }

    return result;
  }, [users, search, roleFilter]);

  const filterValues: FilterValues = { role: roleFilter };

  const handleFilterChange = (
    key: string,
    value: string[] | [number?, number?] | number | null,
  ) => {
    if (key === "role") setRoleFilter(value as string[]);
  };

  const handleFilterClear = () => setRoleFilter([]);

  const handleFilterRemove = (key: string, value?: string) => {
    if (key === "role" && value) {
      setRoleFilter((prev) => prev.filter((r) => r !== value));
    }
  };

  const activeFilterCount = roleFilter.length;

  return (
    <div className="flex gap-6 flex-1 min-h-0">
      <FilterSidebar
        groups={FILTER_GROUPS}
        values={filterValues}
        onChange={handleFilterChange}
        onClear={handleFilterClear}
      />
      <div className="flex-1 min-w-0 flex flex-col min-h-0 gap-3">
        <div className="shrink-0 flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("users.searchPlaceholder")}
          />
          <MobileFilterSheet
            groups={FILTER_GROUPS}
            values={filterValues}
            onChange={handleFilterChange}
            onClear={handleFilterClear}
            activeCount={activeFilterCount}
          />
          <span className="text-xs text-muted-foreground ml-auto tabular-nums">
            {filtered.length.toLocaleString()} {filtered.length !== 1 ? t("users.usersLabel") : t("users.userLabel")}
          </span>
        </div>
        <ActiveFilters
          groups={FILTER_GROUPS}
          values={filterValues}
          onRemove={handleFilterRemove}
          onClearAll={handleFilterClear}
        />
        <div className="flex-1 min-h-0 overflow-y-auto pb-6">
          {filtered.length === 0 ? (
            <Alert>
              <AlertTitle>{t("admin.noUsers")}</AlertTitle>
              <AlertDescription>{t("users.adjustSearch")}</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {filtered.map((user) => (
                <div key={user.id} className="border rounded-lg p-4 bg-background">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{user.name || user.email}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {user.role === "USER" ? t("users.user") : user.role === "SELLER" ? t("users.seller") : t("users.admin")}
                    </Badge>
                  </div>
                  <UserForm userId={user.id} currentRole={user.role} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
