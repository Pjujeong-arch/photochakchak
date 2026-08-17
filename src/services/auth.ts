import { requestJson } from "./api";
import type { SubscribeUser } from "../types/photochak";

export type AuthConfig = {
  googleClientId: string;
  authReady: boolean;
};

export type AuthSession = SubscribeUser & {
  email: string;
  subscribed: boolean;
};

/** Public OAuth client id only — never returns secrets or API keys. */
export function fetchAuthConfig() {
  return requestJson<AuthConfig>("/api/config");
}

export function fetchSession() {
  return requestJson<AuthSession>("/api/me");
}

/** Exchange Google ID token for an HttpOnly session cookie. */
export function loginWithGoogleCredential(credential: string) {
  return requestJson<AuthSession>("/api/auth/google", {
    method: "POST",
    body: { credential: String(credential || "") },
  });
}

export function logoutSession() {
  return requestJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

/** Local/demo: mark the logged-in session as subscribed. Production should use a payment webhook. */
export function activateSubscribe() {
  return requestJson<AuthSession>("/api/subscribe", { method: "POST" });
}
