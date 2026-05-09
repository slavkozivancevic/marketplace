"use client";

import { useTransition, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cancelInviteAction } from "../actions/invites";
import { Invite } from "@/generated/prisma/client";

interface InviteListProps {
  invites: Invite[];
  canManage: boolean;
}

export function InviteList({ invites, canManage }: InviteListProps) {
  const t = useTranslations("invite");
  const dl = dateLocale(useLocale());
  const [isPending, startTransition] = useTransition();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = (inviteId: string) => {
    setCancellingId(inviteId);
    startTransition(async () => {
      const result = await cancelInviteAction(inviteId);

      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        toast.success(t("cancelled"));
      }
      setCancellingId(null);
    });
  };

  if (invites.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noPending")}</p>;
  }

  return (
    <div className="space-y-2">
      {invites.map((invite) => {
        const isCancelling = isPending && cancellingId === invite.id;
        return (
          <div key={invite.id} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">{invite.email}</p>
              <p className="text-xs text-muted-foreground">
                {t("expires", { date: new Date(invite.expiresAt).toLocaleDateString(dl, { year: "numeric", month: "short", day: "numeric" }) })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {invite.role === "ADMIN" ? t("roleAdmin") : t("roleMember")}
              </Badge>
              {canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleCancel(invite.id)}
                >
                  {isCancelling && <Loader2 className="animate-spin" />}
                  {isCancelling ? t("cancelling") : t("cancel")}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
