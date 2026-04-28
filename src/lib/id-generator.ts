import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

function pad(n: number, len: number) {
  return String(n).padStart(len, "0");
}

function mmyy(now: Date = new Date()) {
  const mm = pad(now.getMonth() + 1, 2);
  const yy = pad(now.getFullYear() % 100, 2);
  return `${mm}${yy}`;
}

// DI{MMYY}{0001} — drawing / part ID
export async function generateDrawingId(now: Date = new Date()): Promise<string> {
  const prefix = `DI${mmyy(now)}`;
  const counter = await prisma.$transaction(
    async (tx) =>
      tx.drawingCounter.upsert({
        where: { prefix },
        update: { lastSequence: { increment: 1 } },
        create: { prefix, lastSequence: 1 },
      }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  return `${prefix}${pad(counter.lastSequence, 4)}`;
}

// SO-{MMYY}-{0001} — order display ID
export async function generateOrderDisplayId(now: Date = new Date()): Promise<string> {
  const prefix = `SO${mmyy(now)}`;
  const counter = await prisma.$transaction(
    async (tx) =>
      tx.orderCounter.upsert({
        where: { prefix },
        update: { lastSequence: { increment: 1 } },
        create: { prefix, lastSequence: 1 },
      }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  return `SO-${mmyy(now)}-${pad(counter.lastSequence, 4)}`;
}

// Simple random tokens for IDs that don't need counters
export function generatePublicId(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = prefix + "-";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}
