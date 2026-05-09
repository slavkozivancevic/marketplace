import { getLocale } from "next-intl/server";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getInviteByToken } from "@/features/organizations/db/invites";
import { acceptInviteAction } from "@/features/organizations/actions/invites";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { InviteStatus } from "@/generated/prisma/client";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  await connection();
  const { token } = await params;
  const { userId } = await auth();

  const invite = await getInviteByToken(token);
  const dl = dateLocale(await getLocale());

  if (!invite) return notFound();

  const isExpired = invite.expiresAt < new Date();
  const isInvalid = invite.status !== InviteStatus.PENDING || isExpired;

  if (!userId) {
    const signInUrl = `/sign-in?redirect_url=/invite/${token}`;
    redirect(signInUrl);
  }

  if (isInvalid) {
    return (
      <div className="container px-6">
        <PageHeader
          title="Invalid Invite"
          description="This invite is no longer valid."
        />
        <Alert variant="destructive">
          <AlertTitle>
            {isExpired ? "Invite Expired" : "Invite Already Used"}
          </AlertTitle>
          <AlertDescription>
            {isExpired
              ? "This invite has expired. Please ask your organization owner to send a new invite."
              : "This invite has already been used or canceled."}
          </AlertDescription>
        </Alert>
        <Button asChild className="mt-4">
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-md px-6">
      <PageHeader
        title="Organization Invite"
        description="You have been invited to join an organization."
      />

      <Card>
        <CardHeader>
          <CardTitle>{invite.organization.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Your role:</span>
            <Badge variant="secondary">
              {invite.role.charAt(0) + invite.role.slice(1).toLowerCase()}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Invite expires on {new Date(invite.expiresAt).toLocaleDateString(dl, { year: "numeric", month: "short", day: "numeric" })}.
          </p>

          <form
            action={async () => {
              "use server";
              const result = await acceptInviteAction(token);
              if (!result || !("error" in result)) {
                redirect("/dashboard/organization");
              }
            }}
          >
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                Accept Invite
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/dashboard">Decline</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
