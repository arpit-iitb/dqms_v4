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

// LQ-{MMYY}-{0001} — lead display ID
export async function generateLeadDisplayId(now: Date = new Date()): Promise<string> {
  const prefix = `LQ${mmyy(now)}`;
  const counter = await prisma.$transaction(
    async (tx) =>
      tx.leadCounter.upsert({
        where: { prefix },
        update: { lastSequence: { increment: 1 } },
        create: { prefix, lastSequence: 1 },
      }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  return `LQ-${mmyy(now)}-${pad(counter.lastSequence, 4)}`;
}

// SO-{MMYY}-{0001} — sales order display ID
export async function generateSalesOrderDisplayId(now: Date = new Date()): Promise<string> {
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

// Alias for backward compat during migration
export const generateOrderDisplayId = generateSalesOrderDisplayId;

// Simple random tokens for IDs that don't need counters
export function generatePublicId(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = prefix + "-";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// Revision letter: 1→"" (base), 2→"A", 3→"B", etc.
export function revisionLetter(revisionNumber: number): string {
  if (revisionNumber <= 1) return "";
  const index = revisionNumber - 2;
  if (index < 26) return String.fromCharCode(65 + index);
  const first = String.fromCharCode(65 + Math.floor(index / 26) - 1);
  const second = String.fromCharCode(65 + (index % 26));
  return first + second;
}

// Full revision ID: DI04260051.revA
export function revisionId(basePublicId: string, revisionNumber: number): string {
  const letter = revisionLetter(revisionNumber);
  return letter ? `${basePublicId}.rev${letter}` : basePublicId;
}
