import { z } from "zod";
import type { AuthService } from "./service";
import { runtimeAuth } from "./service";
import { readSessionCookie, sessionCookie } from "./cookies";
import { AppError } from "../../domain/errors";
import { readConfig, type AppConfig } from "../../server/config";
import { assertSameOrigin, createAuthorization, trustedClientAddress, type Authorization } from "../../server/authorization";
import { apiResponse, jsonData, readSmallJson } from "../../server/http";

const loginInput = z.strictObject({ username: z.string().min(1).max(128), password: z.string().min(1).max(1024) });
export function createAuthHandlers({ auth, authorization, config, now = () => new Date() }: { auth: AuthService; authorization: Authorization; config: AppConfig; now?: () => Date }) {
  const login = (request: Request) => apiResponse(async () => {
    assertSameOrigin(request, config);
    const input = loginInput.safeParse(await readSmallJson(request));
    if (!input.success) throw new AppError("INVALID_INPUT", 422, "Enter a username and password.");
    const session = await auth.signIn(input.data.username, input.data.password, now(), trustedClientAddress(request, config));
    return jsonData({ role: session.actor.role, csrfToken: session.csrfToken, redirect: session.actor.role === "admin" ? "/admin" : "/shop" }, { "Set-Cookie": sessionCookie(config, session.token) });
  });
  const session = (request: Request) => apiResponse(async () => {
    const context = await authorization.requireActor(request);
    const token = readSessionCookie(request, config)!;
    return jsonData({ actor: context.actor, csrfToken: auth.csrfToken(token) });
  });
  const adminSession = (request: Request) => apiResponse(async () => {
    const context = await authorization.requireActor(request, "admin");
    return jsonData({ actor: context.actor });
  });
  const logout = (request: Request) => apiResponse(async () => {
    const context = await authorization.requireActor(request);
    await authorization.authorizeMutation(request, context);
    await auth.signOut(readSessionCookie(request, config)!);
    return jsonData({ signedOut: true }, { "Set-Cookie": sessionCookie(config, "", 0) });
  });
  return { login, logout, session, adminSession };
}
export function handleAuth(name: keyof ReturnType<typeof createAuthHandlers>, request: Request): Promise<Response> {
  return apiResponse(async () => {
    const config = readConfig(process.env);
    const auth = runtimeAuth();
    const authorization = createAuthorization({ auth, config });
    return createAuthHandlers({ auth, authorization, config })[name](request);
  });
}
