"use client";

import { useMemo, useState } from "react";
import { SearchInput } from "@/components/search/SearchInput";
import { FilterSidebar, type FilterGroup, type FilterValues } from "@/components/search/FilterSidebar";
import { ActiveFilters } from "@/components/search/ActiveFilters";
import { MobileFilterSheet } from "@/components/search/FilterSidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { OrganizationCard } from "./OrganizationCard";

interface SerializedOrganization {
  id: string;
  name: string;
  verified: boolean;
  members: {
    role: string;
    user: {
      id: string;
      name: string | null;
      email: string;
      role: string;
      imageUrl: string | null;
    };
  }[];
}

const FILTER_GROUPS: FilterGroup[] = [
  {
    type: "checkbox",
    key: "verified",
    label: "Verification",
    options: [
      { value: "true", label: "Verified" },
      { value: "false", label: "Unverified" },
    ],
  },
];

export function AdminOrganizationsPage({
  organizations,
}: {
  organizations: SerializedOrganization[];
}) {
  const [search, setSearch] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState<string[]>([]);

  const filtered = useMemo(() => {
    let result = organizations;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (org) =>
          org.name.toLowerCase().includes(q) ||
          org.members.some(
            (m) =>
              m.user.name?.toLowerCase().includes(q) ||
              m.user.email.toLowerCase().includes(q),
          ),
      );
    }

    if (verifiedFilter.length > 0) {
      result = result.filter((org) =>
        verifiedFilter.includes(String(org.verified)),
      );
    }

    return result;
  }, [organizations, search, verifiedFilter]);

  const filterValues: FilterValues = { verified: verifiedFilter };

  const handleFilterChange = (key: string, value: string[] | [number?, number?]) => {
    if (key === "verified") setVerifiedFilter(value as string[]);
  };

  const handleFilterClear = () => setVerifiedFilter([]);

  const handleFilterRemove = (key: string, value?: string) => {
    if (key === "verified" && value) {
      setVerifiedFilter((prev) => prev.filter((v) => v !== value));
    }
  };

  const activeFilterCount = verifiedFilter.length;

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
            placeholder="Search organizations or members..."
          />
          <MobileFilterSheet
            groups={FILTER_GROUPS}
            values={filterValues}
            onChange={handleFilterChange}
            onClear={handleFilterClear}
            activeCount={activeFilterCount}
          />
          <span className="text-xs text-muted-foreground ml-auto tabular-nums">
            {filtered.length.toLocaleString()} organization
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
            <AlertTitle>No organizations found</AlertTitle>
            <AlertDescription>
              Try adjusting your search or filters.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((org) => (
              <OrganizationCard key={org.id} organization={org} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}