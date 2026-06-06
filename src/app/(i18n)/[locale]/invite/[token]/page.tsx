import { getLocale, getTranslations } from "next-intl/server";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getInviteByToken } from "@/features/organizations/db/invites";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "@/i18n/navigation";
import { InviteActions } from "@/features/organizations/components/InviteActions";
import { InviteStatus } from "@/generated/prisma/client";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  await connection();
  const { token } = await params;
  const { userId } = await auth();

  const locale = await getLocale();
  const t = await getTranslations("invite");
  const invite = await getInviteByToken(token);
  const dl = dateLocale(locale);

  if (!invite) return notFound();

  const isExpired = invite.expiresAt < new Date();
  const isInvalid = invite.status !== InviteStatus.PENDING || isExpired;

  if (!userId) {
    // Build a fully-localized sign-in URL with a same-locale return path so
    // the middleware doesn't have to bounce twice (no-locale -> locale).
    const signInUrl = `/${locale}/sign-in?redirect_url=${encodeURIComponent(`/${locale}/invite/${token}`)}`;
    redirect(signInUrl);
  }

  if (isInvalid) {
    return (
      <div className="container px-6">
        <PageHeader
          title={t("invalidTitle")}
          description={t("invalidDesc")}
        />
        <Alert variant="destructive">
          <AlertTitle>
            {isExpired ? t("expiredHeading") : t("usedHeading")}
          </AlertTitle>
          <AlertDescription>
            {isExpired ? t("expiredBody") : t("usedBody")}
          </AlertDescription>
        </Alert>
        <Button asChild className="mt-4">
          <Link href="/dashboard">{t("goToDashboard")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-md px-6">
      <PageHeader
        title={t("pageTitle")}
        description={t("pageDesc")}
      />

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
            {t("expiresOn", { date: new Date(invite.expiresAt).toLocaleDateString(dl, { year: "numeric", month: "short", day: "numeric" }) })}
          </p>

          <InviteActions token={token} />
        </CardContent>
      </Card>
    </div>
  );
}