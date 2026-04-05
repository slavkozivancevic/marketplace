"use client";

import { useTransition } from "react";
import { toast } from "@/components/ui/sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { switchOrganizationAction } from "../actions/switchOrganization";

interface Organization {
  id: string;
  name: string;
}

interface OrganizationSwitcherProps {
  organizations: Organization[];
  currentOrgId: string;
}

export function OrganizationSwitcher({
  organizations,
  currentOrgId,
}: OrganizationSwitcherProps) {
  const [isPending, startTransition] = useTransition();

  const handleSwitch = (orgId: string) => {
    if (orgId === currentOrgId) return;

    startTransition(async () => {
      const result = await switchOrganizationAction(orgId);

      if (result && "error" in result) {
        toast.error(result.message);
      }
    });
  };

  return (
    <Select
      value={currentOrgId}
      onValueChange={handleSwitch}
      disabled={isPending}
    >
      <SelectTrigger className="w-full text-sm cursor-pointer">
        <SelectValue placeholder="Select organization" />
      </SelectTrigger>
      <SelectContent>
        {organizations.map((org) => (
          <SelectItem key={org.id} value={org.id} className="cursor-pointer">
            {org.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
