import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalcPlanTotals } from "../route";
import { sendEmail, renderTemplate, textToHtml } from "@/lib/email";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string; blockId: string }> },
) {
  const { planId, blockId } = await params;
  const body = await req.json();
  const { stepData, status, processName, notes, vendorId, deadline,
          emailEnabled, emailRecipient, emailTemplate, emailContent, emailTrigger } = body;

  // Fetch old block to detect status transition
  const oldBlock = await prisma.planBlock.findUnique({ where: { id: blockId } });

  const block = await prisma.planBlock.update({
    where: { id: blockId },
    data: {
      ...(stepData !== undefined && { stepData }),
      ...(status !== undefined && { status }),
      ...(processName !== undefined && { processName }),
      ...(notes !== undefined && { notes }),
      ...(vendorId !== undefined && { vendorId }),
      ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
      ...(status === "DONE" && { completedAt: new Date() }),
      ...(status === "IN_PROGRESS" && { startedAt: new Date() }),
      // Email trigger config
      ...(emailEnabled !== undefined && { emailEnabled }),
      ...(emailRecipient !== undefined && { emailRecipient: emailRecipient || null }),
      ...(emailTemplate !== undefined && { emailTemplate: emailTemplate || null }),
      ...(emailContent !== undefined && { emailContent: emailContent || null }),
      ...(emailTrigger !== undefined && { emailTrigger: emailTrigger || null }),
    },
    include: { vendor: true },
  });

  await recalcPlanTotals(planId);

  // Auto-send email if block has emailEnabled and trigger matches
  if (
    oldBlock &&
    block.emailEnabled &&
    block.emailRecipient &&
    block.emailTrigger
  ) {
    const triggerFired =
      (block.emailTrigger === "COMPLETE" && status === "DONE" && oldBlock.status !== "DONE") ||
      (block.emailTrigger === "START" && status === "IN_PROGRESS" && oldBlock.status === "PENDING");

    if (triggerFired) {
      let subject = `Manufacturing update: ${block.processName ?? block.type}`;
      let emailBody = `Step "${block.processName ?? block.type}" has ${block.emailTrigger === "COMPLETE" ? "been completed" : "started"}.`;

      // Load template if key is set
      if (block.emailTemplate) {
        const tpl = await prisma.emailTemplate.findUnique({ where: { key: block.emailTemplate } });
        if (tpl) {
          const plan = await prisma.manufacturingPlan.findUnique({
            where: { id: planId },
            include: { part: { include: { order: { include: { client: true } } } } },
          });
          const vars: Record<string, string> = {
            stepName: block.processName ?? block.type,
            orderDisplayId: plan?.part.order.displayId ?? "",
            clientName: plan?.part.order.client.name ?? "",
            partPublicId: plan?.part.publicId ?? "",
          };
          subject = renderTemplate(tpl.subject, vars);
          emailBody = renderTemplate(tpl.body, vars);
        }
      }

      await sendEmail({ to: block.emailRecipient, subject, html: textToHtml(emailBody) });

      // Log it
      const plan = await prisma.manufacturingPlan.findUnique({ where: { id: planId } });
      if (plan) {
        const part = await prisma.part.findUnique({ where: { id: plan.partId }, select: { orderId: true } });
        if (part) {
          await prisma.blockEmailLog.create({
            data: {
              blockId,
              recipient: block.emailRecipient,
              templateId: block.emailTemplate ?? "custom",
              status: "sent",
            },
          });
        }
      }
    }
  }

  return NextResponse.json({ block });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ planId: string; blockId: string }> },
) {
  const { planId, blockId } = await params;
  await prisma.planBlock.delete({ where: { id: blockId } });
  await recalcPlanTotals(planId);
  return NextResponse.json({ ok: true });
}
