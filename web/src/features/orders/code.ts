import { randomBytes } from "node:crypto";
import { CODE_ALPHABET } from "./code-format";
export { CODE_ALPHABET, normalizeCode } from "./code-format";
export function generateOrderCode(): string { return [...randomBytes(6)].map(byte => CODE_ALPHABET[byte & 31]).join(""); }
