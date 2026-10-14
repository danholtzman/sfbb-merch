import { z } from "zod";
import { calendarDateSchema, idSchema, versionSchema } from "../../domain/schemas";
import { AppError } from "../../domain/errors";
export const settingsSchema = z.strictObject({
  name: z.string().trim().min(1).max(80), opensOn: calendarDateSchema, closesOn: calendarDateSchema,
  announcement: z.string().trim().max(2000),
});
export const createSchema = settingsSchema.extend({ copyFromSeasonId: idSchema.nullable(), reuseArtwork: z.boolean() });
export const versionInputSchema = z.strictObject({ expectedVersion: versionSchema });
export type SeasonSettingsInput = z.infer<typeof settingsSchema>;
export type CreateSeasonInput = z.infer<typeof createSchema>;
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError("INVALID_INPUT", 422, "Please check the season fields.", Object.fromEntries(result.error.issues.map(i => [i.path.join("."), i.message])));
  return result.data;
}
export function validateDates(input: SeasonSettingsInput): void {
  if (input.closesOn < input.opensOn) throw new AppError("INVALID_INPUT", 422, "Closing date cannot precede opening date.", { closesOn: "Choose the opening date or a later date." });
}
