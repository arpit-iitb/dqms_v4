import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, renderTemplate, textToHtml } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { templateKey, subject: rawSubject, body: rawBody, recipientEmail, recipientName, variables } = await req.json();

  if (!recipientEmail) {
    return NextResponse.json({ error: "recipientEmail required" }, { status: 400 });
  }

  let subject = rawSubject ?? "";
  let body = rawBody ?? "";

  if (templateKey) {
    const template = await prisma.emailTemplate.findUnique({ where: { key: templateKey } });
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    const vars: Record<string, string> = variables ?? {};
    subject = renderTemplate(template.subject, vars);
    body = renderTemplate(template.body, vars);
  }

  if (!subject || !body) {
    return NextResponse.json({ error: "subject and body required" }, { status: 400 });
  }

  const result = await sendEmail({ to: recipientEmail, subject, html: textToHtml(body) });

  const log = await prisma.emailLog.create({
    data: {
      leadId: id,
      templateKey: templateKey ?? null,
      subject,
      body,
      recipientEmail,
      recipientName: recipientName ?? null,
    },
  });

  if (!result.ok) {
    return NextResponse.json({ log, warning: result.error }, { status: 207 });
  }

  return NextResponse.json({ log }, { status: 201 });
}
