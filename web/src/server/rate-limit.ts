import type { DbTransaction } from "./db";

export async function isRateLimited(tx: DbTransaction, key: string, now: Date, limit: number): Promise<boolean> {
  const bucket = await tx.rateLimitBucket.findUnique({ where: { key } });
  return !!bucket && bucket.expiresAt > now && bucket.count >= limit;
}
export async function recordFailure(tx: DbTransaction, key: string, now: Date, windowMs: number): Promise<void> {
  const bucket = await tx.rateLimitBucket.findUnique({ where: { key } });
  if (bucket && bucket.expiresAt > now) {
    await tx.rateLimitBucket.update({ where: { key }, data: { count: { increment: 1 } } });
  } else {
    await tx.rateLimitBucket.upsert({ where: { key }, create: { key, count: 1, expiresAt: new Date(now.getTime() + windowMs) }, update: { count: 1, expiresAt: new Date(now.getTime() + windowMs) } });
  }
}
export async function clearFailures(tx: DbTransaction, key: string): Promise<void> {
  await tx.rateLimitBucket.deleteMany({ where: { key } });
}
