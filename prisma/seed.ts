import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.OPS_EMAIL ?? "ops@mechximize.com";
  const password = process.env.OPS_PASSWORD ?? "operations123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, 12),
        name: "Operations",
        role: "ADMIN",
      },
    });
    console.log(`✓ Seeded admin user: ${email}`);
  } else {
    console.log(`ℹ Admin user already exists: ${email}`);
  }

  // Seed default email templates
  const templates = [
    {
      key: "rfq_vendor",
      displayName: "RFQ to Vendor",
      subject: "Request for Quotation — {rfqNumber}",
      body: `Dear {vendorName},\n\nWe request a quotation for the following parts:\n\n{partsList}\n\nPlease submit your quote by {dueDate}.\n\nBest regards,\nMechximize Team`,
    },
    {
      key: "client_proposal",
      displayName: "Client Proposal",
      subject: "Quotation — {quoteNumber}",
      body: `Dear {clientName},\n\nPlease find enclosed our quotation for your reference.\n\nQuote Number: {quoteNumber}\nValid Until: {validUntil}\n\nBest regards,\nMechximize Team`,
    },
    {
      key: "order_update",
      displayName: "Production Update",
      subject: "Production Update — {orderDisplay}",
      body: `Dear {clientName},\n\nHere is a progress update on your order {orderDisplay}.\n\n{updateDetails}\n\nBest regards,\nMechximize Team`,
    },
  ];

  for (const t of templates) {
    await prisma.emailTemplate.upsert({
      where: { key: t.key },
      update: {},
      create: t,
    });
  }
  console.log(`✓ Seeded ${templates.length} email templates`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
