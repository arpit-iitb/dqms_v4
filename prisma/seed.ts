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

  // Seed manufacturing processes
  const processes: { name: string; category: string }[] = [
    // Machining
    { name: "CNC Milling", category: "Machining" },
    { name: "CNC Turning", category: "Machining" },
    { name: "Wire EDM", category: "Machining" },
    { name: "Grinding", category: "Machining" },
    { name: "Drilling", category: "Machining" },
    { name: "Boring", category: "Machining" },
    { name: "Honing", category: "Machining" },
    { name: "Lapping", category: "Machining" },
    // Forming
    { name: "Sheet Metal Fabrication", category: "Forming" },
    { name: "Bending", category: "Forming" },
    { name: "Stamping", category: "Forming" },
    { name: "Forging", category: "Forming" },
    { name: "Casting", category: "Forming" },
    { name: "Die Casting", category: "Forming" },
    { name: "Investment Casting", category: "Forming" },
    // Joining
    { name: "TIG Welding", category: "Joining" },
    { name: "MIG Welding", category: "Joining" },
    { name: "Spot Welding", category: "Joining" },
    { name: "Brazing", category: "Joining" },
    { name: "Soldering", category: "Joining" },
    { name: "Riveting", category: "Joining" },
    // Finishing
    { name: "Anodizing", category: "Finishing" },
    { name: "Chrome Plating", category: "Finishing" },
    { name: "Zinc Plating", category: "Finishing" },
    { name: "Powder Coating", category: "Finishing" },
    { name: "Painting", category: "Finishing" },
    { name: "Black Oxide", category: "Finishing" },
    { name: "Electroplating", category: "Finishing" },
    { name: "Passivation", category: "Finishing" },
    { name: "Nitriding", category: "Finishing" },
    { name: "Sandblasting", category: "Finishing" },
    { name: "Heat Treatment", category: "Finishing" },
    { name: "Hardening", category: "Finishing" },
    // Additive
    { name: "3D Printing (FDM)", category: "Additive" },
    { name: "3D Printing (SLA)", category: "Additive" },
    { name: "3D Printing (SLS)", category: "Additive" },
    { name: "3D Printing (DMLS)", category: "Additive" },
    // Inspection
    { name: "CMM Inspection", category: "Inspection" },
    { name: "Dimensional Inspection", category: "Inspection" },
    { name: "Visual Inspection", category: "Inspection" },
    { name: "Hardness Testing", category: "Inspection" },
    { name: "Surface Roughness Testing", category: "Inspection" },
    { name: "Material Certification", category: "Inspection" },
  ];

  let processCount = 0;
  for (const p of processes) {
    await prisma.manufacturingProcess.upsert({
      where: { name: p.name },
      update: {},
      create: p,
    });
    processCount++;
  }
  console.log(`✓ Seeded ${processCount} manufacturing processes`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
