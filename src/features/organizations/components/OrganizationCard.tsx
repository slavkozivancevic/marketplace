"use client";

import { useTransition } from "react";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setOrganizationVerifiedAction } from "../actions/organizations";

interface OrganizationMember {
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    imageUrl: string | null;
  };
}

interface OrganizationCardProps {
  organization: {
    id: string;
    name: string;
    verified: boolean;
    members: OrganizationMember[];
  };
}

export function OrganizationCard({ organization }: OrganizationCardProps) {
  const [isPending, startTransition] = useTransition();

  const handleVerifyToggle = () => {
    startTransition(async () => {
      const result = await setOrganizationVerifiedAction(organization.id, {
        verified: !organization.verified,
      });

      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        toast.success(
          organization.verified
            ? "Organization unverified"
            : "Organization verified",
        );
      }
    });
  };

  return (
    <Card className="border-border/50 transition-all duration-300 hover:shadow-md hover:shadow-primary/5">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="text-lg">{organization.name}</CardTitle>
          <Badge variant={organization.verified ? "default" : "secondary"}>
            {organization.verified ? "Verified" : "Unverified"}
          </Badge>
        </div>
        <Button
          variant={organization.verified ? "destructive" : "default"}
          size="sm"
          disabled={isPending}
          onClick={handleVerifyToggle}
        >
          {isPending
            ? "Saving..."
            : organization.verified
              ? "Unverify"
              : "Verify"}
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium mb-2">
          Members ({organization.members.length})
        </p>
        <div className="space-y-1">
          {organization.members.map((member) => (
            <div
              key={member.user.id}
              className="flex items-center justify-between text-sm"
            >
              <span>{member.user.name || member.user.email}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{member.user.role}</Badge>
                <Badge variant="secondary">{member.role}</Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
