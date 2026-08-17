// Android-only live transaction-SMS auto-parsing via expo-transaction-sms-reader.
// Safely no-ops on web / iOS / Expo Go (native module absent) so the app never crashes.

import { Platform } from "react-native";

let mod: any = null;
let attempted = false;

function lib(): any {
  if (attempted) return mod;
  attempted = true;
  if (Platform.OS !== "android") {
    mod = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("expo-transaction-sms-reader");
  } catch {
    mod = null;
  }
  return mod;
}

export interface ParsedTxn {
  type: string; // DEBIT / CREDIT / ...
  amount: number | null;
  currency: string | null;
  bankCode: string | null;
  channel: string | null;
  merchant: string | null;
  timestamp: number;
  confidence: number;
}

// Whether real native SMS reading is available (requires a dev/production build).
export function isSmsSupported(): boolean {
  const m = lib();
  return !!(m && typeof m.addSmsListener === "function");
}

export type SmsPermission = "granted" | "denied" | "undetermined" | "blocked" | "unsupported";

export async function ensureSmsPermission(): Promise<SmsPermission> {
  const m = lib();
  if (!m) return "unsupported";
  try {
    const status = await m.ensurePermissionsAsync();
    return status as SmsPermission;
  } catch {
    return "unsupported";
  }
}

export async function openSmsSettings(): Promise<void> {
  const m = lib();
  if (m?.openAppSettings) {
    try {
      await m.openAppSettings();
    } catch {}
  }
}

// Backfill recent transaction SMS from the inbox (last N days).
export async function getRecentTxns(days: number = 15): Promise<ParsedTxn[]> {
  const m = lib();
  if (!m?.getRecentMessages) return [];
  try {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const rows = await m.getRecentMessages({
      limit: 100,
      sinceTimestamp: since,
      onlyTransactions: true,
      minConfidence: 0.5,
    });
    return rows
      .map((r: any) => r.transaction)
      .filter((t: any) => t && t.type === "DEBIT" && t.amount)
      .map(normalise);
  } catch {
    return [];
  }
}

// Subscribe to live incoming transaction SMS. Returns an unsubscribe fn.
export function startAutoParse(onTxn: (t: ParsedTxn) => void): () => void {
  const m = lib();
  if (!m?.addSmsListener) return () => {};
  try {
    const sub = m.addSmsListener(
      (event: any) => {
        if (event?.category === "TRANSACTION" && event?.transaction && event.transaction.type === "DEBIT") {
          onTxn(normalise(event.transaction));
        }
      },
      { ignoreOtp: true, minConfidence: 0.5 },
    );
    return () => {
      try {
        sub?.remove?.();
      } catch {}
    };
  } catch {
    return () => {};
  }
}

function normalise(t: any): ParsedTxn {
  return {
    type: t.type,
    amount: t.amount,
    currency: t.currency,
    bankCode: t.bankCode ?? null,
    channel: t.channel ?? null,
    merchant: t.merchant ?? null,
    timestamp: t.timestamp ?? Date.now(),
    confidence: t.confidence ?? 0,
  };
}
