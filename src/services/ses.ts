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

export type OrderConfirmationItem = {
  name: string;
  quantity: number;
  price: number;
};

export type OrderConfirmationShipping = {
  name: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
};

export function buildOrderConfirmationEmailHtml({
  orderId,
  orderUrl,
  items,
  total,
  shipping,
}: {
  orderId: string;
  orderUrl: string;
  items: OrderConfirmationItem[];
  total: number;
  shipping?: OrderConfirmationShipping;
}) {
  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">$${(item.price * item.quantity).toFixed(2)}</td>
      </tr>`,
    )
    .join("");

  const shippingBlock = shipping?.line1
    ? `
      <div style="margin-top: 24px;">
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Shipping Address</h3>
        <p style="color: #444; line-height: 1.6; margin: 0;">
          ${shipping.name ? `${shipping.name}<br>` : ""}
          ${shipping.line1}<br>
          ${shipping.line2 ? `${shipping.line2}<br>` : ""}
          ${[shipping.city, shipping.state, shipping.postalCode].filter(Boolean).join(", ")}<br>
          ${shipping.country ?? ""}
        </p>
      </div>`
    : "";

  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111;">
        <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 4px;">Order Confirmed</h1>
        <p style="color: #555; margin-top: 0;">Thank you for your purchase! Here's a summary of your order.</p>

        <div style="margin-top: 24px;">
          <p style="font-size: 13px; color: #888; margin: 0;">Order ID</p>
          <p style="font-family: monospace; font-size: 14px; margin: 4px 0 0;">${orderId}</p>
        </div>

        <div style="margin-top: 24px;">
          <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Items</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr>
                <th style="text-align: left; padding-bottom: 8px; border-bottom: 2px solid #eee;">Product</th>
                <th style="text-align: center; padding-bottom: 8px; border-bottom: 2px solid #eee;">Qty</th>
                <th style="text-align: right; padding-bottom: 8px; border-bottom: 2px solid #eee;">Price</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding-top: 12px; font-weight: 600;">Total</td>
                <td style="padding-top: 12px; font-weight: 600; text-align: right;">$${total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        ${shippingBlock}

        <div style="margin-top: 32px;">
          <a
            href="${orderUrl}"
            style="
              display: inline-block;
              padding: 12px 24px;
              background-color: #000;
              color: #fff;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 500;
              font-size: 14px;
            "
          >
            View Order
          </a>
        </div>

        <p style="margin-top: 32px; color: #999; font-size: 12px;">
          If you have any questions about your order, please contact our support team.
        </p>
      </body>
    </html>
  `;
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
