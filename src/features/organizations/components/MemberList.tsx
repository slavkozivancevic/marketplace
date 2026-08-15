"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ActionButton";
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
  const router = useRouter();

  // When another user accepts an invite the membership list changes on the
  // server, but that mutation can't reach this already-rendered page on the
  // owner's client (and the cacheComponents Router Cache may hold the prior
  // payload). Refresh on tab focus so accepted members and cleared pending
  // invites appear without manually navigating away and back.
  useEffect(() => {
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

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
      {!canManage && (
        <p className="pt-1 text-xs text-muted-foreground">
          {t("membersManageRestricted")}
        </p>
      )}
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
  const tForm = useTranslations("form");
  const tCommon = useTranslations("common");
  const [isPendingRemove, startRemoveTransition] = useTransition();
  const [isPendingRole, startRoleTransition] = useTransition();

  // Stage the role locally so picking from the dropdown doesn't fire the action
  // (and its notification) immediately - the change is applied only on Save,
  // consistent with every other form in the app.
  const [pendingRole, setPendingRole] = useState<MembershipRole>(member.role);
  const roleDirty = pendingRole !== member.role;

  const isSelf = member.user.id === currentUserId;
  const isOwner = member.role === MembershipRole.OWNER;
  // Admins can't remove or change other admins - only owners can
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

  const handleRoleSave = () => {
    startRoleTransition(async () => {
      const result = await updateMemberRoleAction(member.user.id, pendingRole);
      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        toast.success(t("roleChanged"));
      }
    });
  };

  const roleLabel = (role: MembershipRole) =>
    role === MembershipRole.ADMIN ? t("roleAdmin") : t("roleMember");

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
    <div className="flex flex-col gap-2 py-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{member.user.name || member.user.email}</p>
          <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <Badge variant="outline">{userRoleLabel}</Badge>

          {canActOnMember ? (
            <Select
              value={pendingRole}
              onValueChange={(v) => setPendingRole(v as MembershipRole)}
              disabled={isPendingRole || isPendingRemove}
            >
              <SelectTrigger className="h-8 w-32 text-xs">
                {/* Explicit label so it shows pre-hydration (Radix's
                   SelectContent is portaled and not available for lookup). */}
                <SelectValue>{roleLabel(pendingRole)}</SelectValue>
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
            <ActionButton
              title={t("removeMemberTitle")}
              description={t("removeMemberConfirm", {
                name: member.user.name || member.user.email,
              })}
              confirmText={t("removeMember")}
              cancelText={tCommon("cancel")}
              loadingText={t("removing")}
              isLoading={isPendingRemove}
              onConfirm={handleRemove}
            >
              <Button
                variant="ghost"
                size="sm"
                disabled={isPendingRemove || isPendingRole}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {t("removeMember")}
              </Button>
            </ActionButton>
          )}
        </div>
      </div>

      {/* Role change is staged; applying it (and emailing the member) takes an
          explicit Save, with a Discard escape and the saved value for reference.
          Sits on its own line below the row so it never crowds the controls. */}
      {canActOnMember && roleDirty && (
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 rounded-md bg-muted/40 px-3 py-2">
          <p className="mr-auto flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
            <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
            {tForm("savedValue", { value: roleLabel(member.role) })}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPendingRole(member.role)}
            disabled={isPendingRole || isPendingRemove}
          >
            {tForm("discard")}
          </Button>
          <Button
            size="sm"
            onClick={handleRoleSave}
            disabled={isPendingRole || isPendingRemove}
          >
            {isPendingRole && <Loader2 className="animate-spin" />}
            {isPendingRole ? tForm("saving") : tForm("save")}
          </Button>
        </div>
      )}
    </div>
  );
}
