import { z } from "zod";
import { idSchema, orderLineSchema, adminOrderLineSchema } from "../../domain/schemas";
import { AppError } from "../../domain/errors";
export const memberLineSchema = orderLineSchema.extend({ originalLineId: idSchema.optional() });
export const contactSchema = z.strictObject({ fullName: z.string().trim().min(1).max(100), note: z.string().trim().max(2000).optional().default("") });
export const submitSchema = contactSchema.extend({ seasonId: idSchema, lines: z.array(orderLineSchema).min(1).max(100) });
export const memberEditSchema = contactSchema.extend({ lines: z.array(memberLineSchema).min(1).max(100) });
export const adminEditSchema = contactSchema.extend({ lines: z.array(adminOrderLineSchema).min(1).max(100) });
export const idempotencySchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_:-]+$/);
export type SubmitOrderInput = z.input<typeof submitSchema>;
export type MemberEditInput = z.input<typeof memberEditSchema>;
export type AdminEditInput = z.input<typeof adminEditSchema>;
export function parseOrder<T>(schema: z.ZodType<T>, raw: unknown): T {
 const parsed = schema.safeParse(raw);
 if (!parsed.success) throw new AppError("INVALID_INPUT", 422, "Please check the order fields.", Object.fromEntries(parsed.error.issues.map(i => [i.path.join("."), i.message])));
 return parsed.data;
}
