import { z } from "zod";
import type { OrderView } from "../domain/types";
import { formatUsd } from "../domain/money";

function resendConfig(env: NodeJS.ProcessEnv) {
 const apiKey = env.RESEND_API_KEY?.trim(), from = env.RESEND_FROM_EMAIL?.trim();
 if (env.ORDER_CONFIRMATION_EMAILS_ENABLED !== "true" || !apiKey || !from || /[\r\n]/.test(from + apiKey)) return null;
 const mailbox = from.match(/^[^<>\r\n]+<([^<>]+)>$/)?.[1] ?? from;
 if (!z.email().safeParse(mailbox).success) return null;
 return { apiKey, from };
}

/** Only this boolean is exposed to the shop; credentials remain on the server. */
export function confirmationEmailsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
 return resendConfig(env) !== null;
}

/** Best effort, after commit. Never log provider bodies, credentials or recipients. */
export async function sendOrderConfirmation(order: OrderView, recipient: string, season: { name: string; closesOn: string }): Promise<void> {
 try {
  const config = resendConfig(process.env);
  if (!config) return;
  const text = [
   `Thanks, ${order.fullName}. Your SFBB Merch order is saved.`,
   `Order code: ${order.code}`, `Season: ${season.name}`, "",
   ...order.lines.map(line => `${line.quantity} × ${line.styleName} — ${line.artworkSetName}, ${line.colorName} / ${line.sizeLabel}: ${formatUsd(line.quantity * line.unitPriceCents)}`),
   "", `Total owed: ${formatUsd(order.amountOwedCents)}`,
   "Pay the band separately. No payment was collected.",
   `Save your code to find, edit or cancel your Open order through ${season.closesOn} (San Francisco time).`,
   "Sign in to the shop and choose Find my order. Keep this code private.",
  ].join("\n");
  const response = await fetch("https://api.resend.com/emails", {
   method: "POST", cache: "no-store", signal: AbortSignal.timeout(3000),
   headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `order-confirmation/${order.id}` },
   body: JSON.stringify({ from: config.from, to: [recipient], subject: `SFBB Merch order ${order.code}`, text }),
  });
  // Consume the body within the same timeout so a stalled response is bounded too.
  const result: unknown = await response.json();
  if (!response.ok || !result || typeof result !== "object" || !("id" in result) || typeof result.id !== "string") throw new Error("Email not accepted");
 } catch {
  console.warn("Order confirmation email failed; the order remains saved.");
 }
}
