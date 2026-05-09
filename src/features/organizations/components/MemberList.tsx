"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { removeMemberAction, updateMemberRoleAction } from "../actions/organizations";

const MembershipRole = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
} as const;
type MembershipRole = (typeof MembershipRole)[keyof typeof MembershipRole];

interface Member {
  id: string;
  role: MembershipRole;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
}

interface MemberListProps {
  members: Member[];
  currentUserId: string;
  canManage: boolean;
  currentUserRole: MembershipRole;
}

export function MemberList({ members, currentUserId, canManage, currentUserRole }: MemberListProps) {
  const t = useTranslations("organization");
  const tUsers = useTranslations("users");

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <MemberRow
          key={member.id}
          member={member}
          currentUserId={currentUserId}
          canManage={canManage}
          currentUserRole={currentUserRole}
          t={t}
          tUsers={tUsers}
        />
      ))}
    </div>
  );
}

function MemberRow({
  member,
  currentUserId,
  canManage,
  currentUserRole,
  t,
  tUsers,
}: {
  member: Member;
  currentUserId: string;
  canManage: boolean;
  currentUserRole: MembershipRole;
  t: ReturnType<typeof useTranslations<"organization">>;
  tUsers: ReturnType<typeof useTranslations<"users">>;
}) {
  const [isPendingRemove, startRemoveTransition] = useTransition();
  const [isPendingRole, startRoleTransition] = useTransition();

  const isSelf = member.user.id === currentUserId;
  const isOwner = member.role === MembershipRole.OWNER;
  // Admins can't remove or change other admins — only owners can
  const canActOnMember =
    canManage && !isOwner && !isSelf &&
    (currentUserRole === MembershipRole.OWNER || member.role !== MembershipRole.ADMIN);

  const handleRemove = () => {
    startRemoveTransition(async () => {
      const result = await removeMemberAction(member.user.id);
      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        toast.success(t("memberRemoved"));
      }
    });
  };

  const handleRoleChange = (role: string) => {
    startRoleTransition(async () => {
      const result = await updateMemberRoleAction(member.user.id, role as MembershipRole);
      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        toast.success(t("roleChanged"));
      }
    });
  };

  const memberRoleLabel = isOwner
    ? t("roleOwner")
    : member.role === MembershipRole.ADMIN
    ? t("roleAdmin")
    : t("roleMember");

  const userRoleLabel =
    member.user.role === "USER"
      ? tUsers("user")
      : member.user.role === "SELLER"
      ? tUsers("seller")
      : tUsers("admin");

  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium">{member.user.name || member.user.email}</p>
        <p className="text-xs text-muted-foreground">{member.user.email}</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline">{userRoleLabel}</Badge>

        {canActOnMember ? (
          <Select
            value={member.role}
            onValueChange={handleRoleChange}
            disabled={isPendingRole || isPendingRemove}
          >
            <SelectTrigger className="h-7 w-32 text-xs">
              {isPendingRole ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3 animate-spin" />
                  {t("changingRole")}
                </span>
              ) : (
                <SelectValue />
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MembershipRole.ADMIN}>{t("roleAdmin")}</SelectItem>
              <SelectItem value={MembershipRole.MEMBER}>{t("roleMember")}</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="secondary">{memberRoleLabel}</Badge>
        )}

        {canActOnMember && (
          <Button
            variant="ghost"
            size="sm"
            disabled={isPendingRemove || isPendingRole}
            onClick={handleRemove}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            {isPendingRemove && <Loader2 className="animate-spin" />}
            {isPendingRemove ? t("removing") : t("removeMember")}
          </Button>
        )}
      </div>
    </div>
  );
}
