"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cancelInviteAction } from "../actions/invites";
import { Invite } from "@/generated/prisma/client";

interface InviteListProps {
  invites: Invite[];
  canManage: boolean;
}

export function InviteList({ invites, canManage }: InviteListProps) {
  const t = useTranslations("invite");
  const [isPending, startTransition] = useTransition();

  const handleCancel = (inviteId: string) => {
    startTransition(async () => {
      const result = await cancelInviteAction(inviteId);

      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        toast.success(t("cancelled"));
      }
    });
  };

  if (invites.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noPending")}</p>;
  }

  return (
    <div className="space-y-2">
      {invites.map((invite) => (
        <div key={invite.id} className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium">{invite.email}</p>
            <p className="text-xs text-muted-foreground">
              {t("expires", { date: new Date(invite.expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {invite.role.charAt(0) + invite.role.slice(1).toLowerCase()}
            </Badge>
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => handleCancel(invite.id)}
              >
                {t("cancel")}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
