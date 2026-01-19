import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const sesClient = new SESv2Client({
  region: process.env.AWS_REGION || "us-east-1",
});

// Email from address - should match verified SES identity
const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@sierramcp.com";
const APP_NAME = "SierraMCP";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.sierramcp.com";

interface SendInvitationEmailParams {
  to: string;
  inviterName: string;
  tenantName: string;
  role: string;
  inviteToken: string;
}

/**
 * Send an invitation email to a new team member
 */
export async function sendInvitationEmail({
  to,
  inviterName,
  tenantName,
  role,
  inviteToken,
}: SendInvitationEmailParams): Promise<void> {
  const inviteUrl = `${APP_URL}/accept-invite?token=${inviteToken}`;

  const subject = `You've been invited to join ${tenantName} on ${APP_NAME}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${APP_NAME}</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="margin-top: 0; color: #333;">You're invited!</h2>

    <p>${inviterName} has invited you to join <strong>${tenantName}</strong> on ${APP_NAME} as a <strong>${role.toLowerCase()}</strong>.</p>

    <p>${APP_NAME} helps teams manage MCP servers, applications, and tools for AI agent integrations.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${inviteUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
        Accept Invitation
      </a>
    </div>

    <p style="color: #666; font-size: 14px;">This invitation will expire in 7 days.</p>

    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;">

    <p style="color: #999; font-size: 12px;">
      If you didn't expect this invitation, you can safely ignore this email.
      <br><br>
      If the button doesn't work, copy and paste this link into your browser:
      <br>
      <a href="${inviteUrl}" style="color: #667eea; word-break: break-all;">${inviteUrl}</a>
    </p>
  </div>
</body>
</html>
  `.trim();

  const textBody = `
You've been invited to join ${tenantName} on ${APP_NAME}!

${inviterName} has invited you to join as a ${role.toLowerCase()}.

${APP_NAME} helps teams manage MCP servers, applications, and tools for AI agent integrations.

Accept your invitation by visiting:
${inviteUrl}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.
  `.trim();

  try {
    await sesClient.send(
      new SendEmailCommand({
        FromEmailAddress: FROM_EMAIL,
        Destination: {
          ToAddresses: [to],
        },
        Content: {
          Simple: {
            Subject: {
              Data: subject,
              Charset: "UTF-8",
            },
            Body: {
              Html: {
                Data: htmlBody,
                Charset: "UTF-8",
              },
              Text: {
                Data: textBody,
                Charset: "UTF-8",
              },
            },
          },
        },
      })
    );

    console.log(`Invitation email sent successfully to ${to}`);
  } catch (error) {
    console.error("Failed to send invitation email:", error);
    throw new Error(`Failed to send invitation email: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
