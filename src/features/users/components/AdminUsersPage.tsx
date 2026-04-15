"use client";

import { useMemo, useState } from "react";
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

const FILTER_GROUPS: FilterGroup[] = [
  {
    type: "checkbox",
    key: "role",
    label: "Role",
    options: [
      { value: "USER", label: "User" },
      { value: "SELLER", label: "Seller" },
      { value: "ADMIN", label: "Admin" },
    ],
  },
];

export function AdminUsersPage({ users }: { users: SerializedUser[] }) {
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
    value: string[] | [number?, number?],
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
    <div className="flex gap-6">
      <FilterSidebar
        groups={FILTER_GROUPS}
        values={filterValues}
        onChange={handleFilterChange}
        onClear={handleFilterClear}
      />
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search users by name or email..."
          />
          <MobileFilterSheet
            groups={FILTER_GROUPS}
            values={filterValues}
            onChange={handleFilterChange}
            onClear={handleFilterClear}
            activeCount={activeFilterCount}
          />
          <span className="text-xs text-muted-foreground ml-auto tabular-nums">
            {filtered.length.toLocaleString()} user
            {filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        <ActiveFilters
          groups={FILTER_GROUPS}
          values={filterValues}
          onRemove={handleFilterRemove}
          onClearAll={handleFilterClear}
        />
        {filtered.length === 0 ? (
          <Alert>
            <AlertTitle>No users found</AlertTitle>
            <AlertDescription>
              Try adjusting your search or filters.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {filtered.map((user) => (
              <div key={user.id} className="border rounded-lg p-4">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{user.name || user.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <Badge variant="outline">{user.role}</Badge>
                </div>
                <UserForm userId={user.id} currentRole={user.role} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
