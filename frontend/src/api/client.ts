import Constants from "expo-constants";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

import { storage } from "@/src/utils/storage";

export const SESSION_TOKEN_KEY = "spoilancer.session_token";

let inMemoryToken: string | null = null;

export function setToken(token: string | null) {
  inMemoryToken = token;
}

async function getToken(): Promise<string | null> {
  if (inMemoryToken) return inMemoryToken;
  const t = await storage.secureGet<string>(SESSION_TOKEN_KEY, "");
  inMemoryToken = t && typeof t === "string" && t.length > 0 ? t : null;
  return inMemoryToken;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: any; auth?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    const err: any = new Error(text || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

export const api = {
  createSession: (sessionId: string) =>
    request<{ session_token: string; user: any }>("/auth/session", {
      method: "POST",
      body: { session_id: sessionId },
      auth: false,
    }),
  me: () => request<any>("/auth/me"),
  logout: () => request<any>("/auth/logout", { method: "POST" }),
  analyzeAdvisor: (payload: any) =>
    request<any>("/advisor/analyze", { method: "POST", body: payload }),
};

export { getToken };
