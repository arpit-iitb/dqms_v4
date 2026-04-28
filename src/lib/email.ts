import nodemailer from "nodemailer";

function isConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isConfigured()) {
    return { ok: false, error: "SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS" };
  }
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? `"Mechximize" <${process.env.SMTP_USER}>`,
      ...opts,
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Unknown SMTP error" };
  }
}

/** Replace {{key}} placeholders in a template body string */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, v ?? ""),
    body
  );
}

/** Wrap plain text body in minimal HTML */
export function textToHtml(text: string): string {
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1e293b;max-width:600px">
${text
  .split("\n")
  .map((line) => `<p style="margin:0 0 8px">${line || "&nbsp;"}</p>`)
  .join("")}
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
<p style="font-size:12px;color:#94a3b8">Sent via Mechximize</p>
</div>`;
}
