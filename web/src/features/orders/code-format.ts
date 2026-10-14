// Safe to share with browser code; cryptographic generation stays server-side.
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function normalizeCode(raw: string): string | null { if (typeof raw !== "string") return null; const code = raw.trim().toUpperCase(); return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(code) ? code : null; }
