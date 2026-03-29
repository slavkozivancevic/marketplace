import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { env } from "@/env/server";

const ses = new SESClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  await ses.send(
    new SendEmailCommand({
      Source: env.SES_FROM_EMAIL,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data: html,
            Charset: "UTF-8",
          },
        },
      },
    }),
  );
}

export function buildInviteEmailHtml({
  organizationName,
  inviteUrl,
  role,
}: {
  organizationName: string;
  inviteUrl: string;
  role: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h1 style="font-size: 24px; font-weight: bold;">You've been invited</h1>
        <p>You have been invited to join <strong>${organizationName}</strong> as a <strong>${role}</strong>.</p>
        <p>This invite expires in 7 days.</p>

        <a 
          href="${inviteUrl}"
          style="
            display: inline-block;
            margin-top: 16px;
            padding: 12px 24px;
            background-color: #000;
            color: #fff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
          "
        >
          Accept Invite
        </a>

        <p style="margin-top: 24px; color: #666; font-size: 14px;">
          If you did not expect this invitation, you can ignore this email.
        </p>
      </body>
    </html>
  `;
}
