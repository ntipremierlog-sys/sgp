import { describe, it, expect } from "vitest";
import prisma, { prisma as namedPrisma } from "@/lib/prisma";

describe("Prisma Singleton — Prevenção de Conexões Excessivas em Serverless", () => {
  it("deve exportar uma instância definida do PrismaClient", () => {
    expect(prisma).toBeDefined();
    expect(namedPrisma).toBeDefined();
    expect(prisma).toBe(namedPrisma);
  });
});
