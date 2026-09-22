import { getLocale, getTranslations } from "next-intl/server";
import { dateInSentence } from "@/lib/i18n/dateLocale";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { safeAuth } from "@/lib/auth/safeAuth";
import { getInviteByToken } from "@/features/organizations/db/invites";
import { getUserByClerkId } from "@/features/users/db/users";
import { InviteHeading } from "@/features/organizations/components/InviteHeading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "@/i18n/navigation";
import { InviteActions } from "@/features/organizations/components/InviteActions";
import { InviteStatus } from "@/generated/prisma/client";

// One wording per ending. The page used to answer every non-pending invite with
// "already used or canceled", which is a lie told to the one person most likely
// to read it: someone whose invite the organization quietly withdrew.
//
// CANCELED is the legacy value that meant declining AND revoking at once. Rows
// that still carry it are the ones the backfill could not prove either way, so
// they get the one statement that is certainly true instead of a guess.
const ENDED_COPY = {
  [InviteStatus.ACCEPTED]: { heading: "usedHeading", body: "usedBody" },
  [InviteStatus.DECLINED]: { heading: "declinedHeading", body: "declinedBody" },
  [InviteStatus.REVOKED]: { heading: "revokedHeading", body: "revokedBody" },
  [InviteStatus.CANCELED]: { heading: "endedHeading", body: "endedBody" },
} as const;

const EXPIRED_COPY = { heading: "expiredHeading", body: "expiredBody" } as const;

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  await connection();
  const { token } = await params;
  const { userId } = await safeAuth();

  const locale = await getLocale();
  const t = await getTranslations("invite");
  const invite = await getInviteByToken(token);

  if (!invite) return notFound();

  // A final status outranks the clock: an invite you already accepted should
  // say so even after it has sailed past expiresAt. Only a still-pending one is
  // reported as expired.
  const endedCopy =
    invite.status === InviteStatus.PENDING
      ? invite.expiresAt < new Date()
        ? EXPIRED_COPY
        : null
      : ENDED_COPY[invite.status];

  if (!userId) {
    // Build a fully-localized sign-in URL with a same-locale return path so
    // the middleware doesn't have to bounce twice (no-locale -> locale).
    const signInUrl = `/${locale}/sign-in?redirect_url=${encodeURIComponent(`/${locale}/invite/${token}`)}`;
    redirect(signInUrl);
  }

  if (endedCopy) {
    return (
      <div className="w-full max-w-md space-y-6">
        <InviteHeading title={t("invalidTitle")} description={t("invalidDesc")} />
        <Alert variant="destructive">
          <AlertTitle>{t(endedCopy.heading)}</AlertTitle>
          <AlertDescription>{t(endedCopy.body)}</AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/dashboard">{t("goToDashboard")}</Link>
        </Button>
      </div>
    );
  }

  // Surface the account mismatch before the user clicks Accept - the invite is
  // bound to a specific email, so signing in with another account can't claim
  // it. Show which address it's for instead of letting them hit a toast.
  const currentUser = await getUserByClerkId(userId);
  const emailMismatch =
    currentUser != null &&
    currentUser.email.trim().toLowerCase() !==
      invite.email.trim().toLowerCase();

  if (emailMismatch) {
    return (
      <div className="w-full max-w-md space-y-6">
        <InviteHeading title={t("pageTitle")} description={t("pageDesc")} />
        <Alert variant="destructive">
          <AlertTitle>{t("wrongAccountHeading")}</AlertTitle>
          <AlertDescription>
            {t("wrongAccountBody", { email: invite.email })}
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/dashboard">{t("goToDashboard")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <InviteHeading title={t("pageTitle")} description={t("pageDesc")} />

      <Card>
        <CardHeader>
          <CardTitle>{invite.organization.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t("yourRole")}</span>
            <Badge variant="secondary">
              {invite.role === "ADMIN" ? t("roleAdmin") : t("roleMember")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("expiresOn", {
              date: dateInSentence(new Date(invite.expiresAt), locale, {
                year: "numeric",
                month: "short",
                day: "numeric",
              }),
            })}
          </p>

          <InviteActions token={token} />
        </CardContent>
      </Card>
    </div>
  );
}