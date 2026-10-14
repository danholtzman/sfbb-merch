import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { runtimeAuth } from "../features/auth/service";
import { sessionCookieName } from "../features/auth/cookies";
import { readConfig } from "./config";
import type { Role } from "../domain/types";

export async function pageSession() {
  const config = readConfig(process.env);
  const cookieStore = await cookies();
  const matches = cookieStore.getAll(sessionCookieName(config));
  const token = matches.length === 1 ? matches[0].value : undefined;
  const auth = runtimeAuth();
  const actor = await auth.getActor(token, new Date());
  return actor && token ? { actor, csrfToken: auth.csrfToken(token) } : null;
}
export async function requirePageSession(role?: Role) {
  const session = await pageSession();
  if (!session) redirect("/login");
  if (role && session.actor.role !== role) redirect("/shop");
  return session;
}
