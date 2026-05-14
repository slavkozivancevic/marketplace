"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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

export function AdminOrganizationsPage({
  organizations,
}: {
  organizations: SerializedOrganization[];
}) {
  const t = useTranslations();

  const FILTER_GROUPS: FilterGroup[] = [
    {
      type: "checkbox",
      key: "verified",
      label: t("admin.verification"),
      options: [
        { value: "true", label: t("organization.verified") },
        { value: "false", label: t("organization.unverified") },
      ],
    },
  ];

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

  const handleFilterChange = (key: string, value: string[] | [number?, number?] | number | null) => {
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
            placeholder={t("admin.searchOrgs")}
          />
          <MobileFilterSheet
            groups={FILTER_GROUPS}
            values={filterValues}
            onChange={handleFilterChange}
            onClear={handleFilterClear}
            activeCount={activeFilterCount}
          />
          <span className="text-xs text-muted-foreground ml-auto tabular-nums">
            {filtered.length.toLocaleString()} {filtered.length !== 1 ? t("admin.orgsLabel") : t("admin.orgLabel")}
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
              <AlertTitle>{t("admin.noOrgs")}</AlertTitle>
              <AlertDescription>{t("admin.noOrgsDesc")}</AlertDescription>
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
    </div>
  );
}