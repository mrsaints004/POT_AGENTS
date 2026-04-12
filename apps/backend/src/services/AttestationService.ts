import { createHash } from "crypto";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { attestations } from "../schema";

export class AttestationService {
  async getAll() {
    return await db.select().from(attestations).orderBy(desc(attestations.createdAt));
  }

  async getById(id: string) {
    const rows = await db.select().from(attestations).where(eq(attestations.id, id));
    return rows[0] ?? null;
  }

  async getByTaskId(taskId: string) {
    const rows = await db.select().from(attestations).where(eq(attestations.taskId, taskId));
    return rows[0] ?? null;
  }

  static verifyHash(reasoningSteps: unknown[], storedHash: string): boolean {
    const data = JSON.stringify(reasoningSteps);
    const computed = "0x" + createHash("sha256").update(data).digest("hex");
    return computed === storedHash;
  }
}
