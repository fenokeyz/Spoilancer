import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

import { storage } from "@/src/utils/storage";
import { api, setToken, SESSION_TOKEN_KEY } from "@/src/api/client";
import { getProfile, saveProfile } from "@/src/store/finance";

WebBrowser.maybeCompleteAuthSession();

export interface AppUser {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  guest?: boolean;
}

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  continueOffline: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({} as AuthState);

const USER_KEY = "spoilancer.user";
const GUEST_KEY = "spoilancer.guest";

function extractSessionId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const handledIds = useRef<Set<string>>(new Set());

  async function persistUser(u: AppUser) {
    await storage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
    // seed local profile identity
    const p = await getProfile();
    if (p) {
      p.name = u.name;
      p.email = u.email;
      await saveProfile(p);
    }
  }

  async function exchangeSessionId(sessionId: string) {
    if (handledIds.current.has(sessionId)) return;
    handledIds.current.add(sessionId);
    try {
      const data = await api.createSession(sessionId);
      await storage.secureSet(SESSION_TOKEN_KEY, data.session_token);
      setToken(data.session_token);
      await storage.removeItem(GUEST_KEY);
      await persistUser({ ...data.user, guest: false });
    } catch (e) {
      console.warn("Session exchange failed", e);
    }
  }

  // Bootstrap
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Web: handle redirect fragment first
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const sid =
            extractSessionId(window.location.hash) ||
            extractSessionId(window.location.search);
          if (sid) {
            await exchangeSessionId(sid);
            window.history.replaceState(
              window.history.state,
              "",
              window.location.pathname,
            );
            if (mounted) setLoading(false);
            return;
          }
        } else {
          const initial = await Linking.getInitialURL();
          const sid = extractSessionId(initial);
          if (sid) await exchangeSessionId(sid);
        }

        // Existing session token?
        const token = await storage.secureGet<string>(SESSION_TOKEN_KEY, "");
        if (token && typeof token === "string" && token.length > 0) {
          setToken(token);
          try {
            const me = await api.me();
            if (mounted) await persistUser({ ...me, guest: false });
            if (mounted) setLoading(false);
            return;
          } catch {
            await storage.secureRemove(SESSION_TOKEN_KEY);
            setToken(null);
          }
        }

        // Guest?
        const guest = await storage.getItem(GUEST_KEY, "");
        const cachedUser = await storage.getItem<string>(USER_KEY, "");
        if (guest === "1" && cachedUser && typeof cachedUser === "string") {
          if (mounted) setUser(JSON.parse(cachedUser));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Hot deep links (mobile)
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Linking.addEventListener("url", ({ url }) => {
      const sid = extractSessionId(url);
      if (sid) exchangeSessionId(sid);
    });
    return () => sub.remove();
  }, []);

  async function signInWithGoogle() {
    const redirectUrl =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.location.origin + "/"
        : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(
      redirectUrl,
    )}`;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = authUrl;
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    let sid: string | null = null;
    if (result.type === "success" && result.url) {
      sid = extractSessionId(result.url);
    }
    if (!sid) {
      const initial = await Linking.getInitialURL();
      sid = extractSessionId(initial);
    }
    if (sid) await exchangeSessionId(sid);
  }

  async function continueOffline() {
    const guestUser: AppUser = {
      user_id: "guest",
      email: "",
      name: "You",
      guest: true,
    };
    await storage.setItem(GUEST_KEY, "1");
    await storage.setItem(USER_KEY, JSON.stringify(guestUser));
    setUser(guestUser);
  }

  async function signOut() {
    try {
      await api.logout();
    } catch {}
    await storage.secureRemove(SESSION_TOKEN_KEY);
    await storage.removeItem(GUEST_KEY);
    await storage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, signInWithGoogle, continueOffline, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
