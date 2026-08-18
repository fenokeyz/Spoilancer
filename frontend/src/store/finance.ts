// Spoilancer local-first data layer. All financial data lives on-device.
// Objects are persisted as JSON strings via the storage util.

import { storage } from "@/src/utils/storage";

// ---------------- Types ----------------
export type LeftoverTarget = "spoilance" | "savings";

export interface Profile {
  name: string;
  email: string;
  currency: string;
  stipend: number;
  balance: number; // remaining spendable money from THIS month's stipend (excludes spoilance)
  spoilance: number; // current available splurge balance
  spoilanceLimit: number; // monthly allocated splurge budget
  leftoverTarget: LeftoverTarget; // where daily under-spend leftovers go
  onboarded: boolean;
  monthKey: string; // "YYYY-MM" currently tracked
  createdAt: string;
}

export interface ExpenseField {
  id: string;
  weekday: number; // 0=Mon ... 6=Sun
  title: string;
  amount: number; // daily upper limit
  description: string;
  hour: number;
  minute: number;
}

export interface ExpenseEntry {
  id: string;
  fieldId: string;
  title: string;
  dateKey: string; // YYYY-MM-DD
  weekday: number;
  limit: number;
  amount: number; // actual spent
  leftover: number;
  target: LeftoverTarget;
  kind: "budget" | "misc";
  source: "gate" | "manual" | "sms";
  timestamp: string;
  monthKey: string;
}

export interface SpoilanceItem {
  name: string;
  cost: number;
}

export interface SpoilanceLog {
  id: string;
  dateKey: string;
  items: SpoilanceItem[];
  total: number;
  timestamp: string;
  monthKey: string;
}

export interface MonthSnapshot {
  monthKey: string;
  savings: number;
  spoilanceLimit: number;
  spoilanceSpent: number;
  spoilanceLeftover: number;
  totalLimit: number;
  totalSpent: number;
  closedAt: string;
}

// ---------------- Keys ----------------
const K = {
  profile: "spoilancer.profile",
  templates: "spoilancer.templates",
  entries: "spoilancer.entries",
  logs: "spoilancer.logs",
  snapshots: "spoilancer.snapshots",
  advisor: "spoilancer.advisor",
};

// ---------------- JSON helpers ----------------
async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await storage.getItem(key, "");
  if (!raw || typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function saveJSON(key: string, value: unknown): Promise<void> {
  await storage.setItem(key, JSON.stringify(value));
}

// ---------------- Date helpers ----------------
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthKeyOf(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function nextMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + 1, 1);
  return monthKeyOf(d);
}

// JS getDay(): 0=Sun..6=Sat -> our index 0=Mon..6=Sun
export function weekdayIndex(d: Date = new Date()): number {
  return (d.getDay() + 6) % 7;
}

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Count occurrences of each weekday index in the current month
export function weekdayOccurrencesThisMonth(d: Date = new Date()): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const year = d.getFullYear();
  const month = d.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const idx = weekdayIndex(new Date(year, month, day));
    counts[idx]++;
  }
  return counts;
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------- Profile ----------------
export async function getProfile(): Promise<Profile | null> {
  const p = await loadJSON<any>(K.profile, null);
  if (!p) return null;
  // Migration from the old "savings"-based model.
  let dirty = false;
  if (p.balance === undefined) {
    p.balance = p.savings ?? Math.max(0, (p.stipend ?? 0) - (p.spoilanceLimit ?? 0));
    dirty = true;
  }
  if (p.leftoverTarget === undefined) {
    p.leftoverTarget = "spoilance";
    dirty = true;
  }
  if (dirty) {
    delete p.savings;
    await saveJSON(K.profile, p);
  }
  return p as Profile;
}

export async function saveProfile(p: Profile): Promise<void> {
  await saveJSON(K.profile, p);
}

export async function setLeftoverTarget(target: LeftoverTarget): Promise<void> {
  const p = await getProfile();
  if (!p) return;
  p.leftoverTarget = target;
  await saveProfile(p);
}

// ---------------- Templates ----------------
export async function getTemplates(): Promise<ExpenseField[]> {
  return loadJSON<ExpenseField[]>(K.templates, []);
}

export async function saveTemplates(t: ExpenseField[]): Promise<void> {
  await saveJSON(K.templates, t);
}

export async function getTemplatesForDay(weekday: number): Promise<ExpenseField[]> {
  const all = await getTemplates();
  return all
    .filter((f) => f.weekday === weekday)
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
}

export async function addTemplate(f: Omit<ExpenseField, "id">): Promise<void> {
  const all = await getTemplates();
  all.push({ ...f, id: uid() });
  await saveTemplates(all);
}

export async function updateTemplate(f: ExpenseField): Promise<void> {
  const all = await getTemplates();
  const idx = all.findIndex((x) => x.id === f.id);
  if (idx >= 0) all[idx] = f;
  await saveTemplates(all);
}

export async function deleteTemplate(id: string): Promise<void> {
  const all = await getTemplates();
  await saveTemplates(all.filter((x) => x.id !== id));
}

// ---------------- Entries ----------------
export async function getEntries(): Promise<ExpenseEntry[]> {
  return loadJSON<ExpenseEntry[]>(K.entries, []);
}

export async function getEntriesForDate(dateKey: string): Promise<ExpenseEntry[]> {
  const all = await getEntries();
  return all.filter((e) => e.dateKey === dateKey);
}

// Which scheduled fields for right now have not yet been logged today
export async function getPendingFields(now: Date = new Date()): Promise<ExpenseField[]> {
  const wd = weekdayIndex(now);
  const dayFields = await getTemplatesForDay(wd);
  const todaysEntries = await getEntriesForDate(todayKey(now));
  const loggedFieldIds = new Set(todaysEntries.map((e) => e.fieldId));
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return dayFields.filter((f) => {
    const scheduled = f.hour * 60 + f.minute;
    return scheduled <= nowMinutes && !loggedFieldIds.has(f.id);
  });
}

// Log an actual spend against a budgeted field.
// The spent amount always leaves the month balance. Under-spend leftover is
// routed to spoilance OR left in balance (savings) per the user's setting.
export async function logExpense(
  field: ExpenseField,
  spent: number,
  source: ExpenseEntry["source"] = "manual",
  now: Date = new Date(),
): Promise<void> {
  const leftover = round2(field.amount - spent);
  const profile = await getProfile();
  const target: LeftoverTarget = profile?.leftoverTarget ?? "spoilance";

  const entry: ExpenseEntry = {
    id: uid(),
    fieldId: field.id,
    title: field.title,
    dateKey: todayKey(now),
    weekday: field.weekday,
    limit: field.amount,
    amount: spent,
    leftover,
    target,
    kind: "budget",
    source,
    timestamp: now.toISOString(),
    monthKey: monthKeyOf(now),
  };
  const all = await getEntries();
  all.push(entry);
  await saveJSON(K.entries, all);

  if (profile) {
    profile.balance = round2(profile.balance - spent);
    if (leftover > 0 && target === "spoilance") {
      profile.balance = round2(profile.balance - leftover);
      profile.spoilance = round2(profile.spoilance + leftover);
    }
    await saveProfile(profile);
  }
}

// Ad-hoc / miscellaneous expense not tied to any budget field.
export async function logMisc(
  title: string,
  amount: number,
  now: Date = new Date(),
): Promise<void> {
  const entry: ExpenseEntry = {
    id: uid(),
    fieldId: "misc",
    title: title || "Misc expense",
    dateKey: todayKey(now),
    weekday: weekdayIndex(now),
    limit: amount,
    amount,
    leftover: 0,
    target: "savings",
    kind: "misc",
    source: "manual",
    timestamp: now.toISOString(),
    monthKey: monthKeyOf(now),
  };
  const all = await getEntries();
  all.push(entry);
  await saveJSON(K.entries, all);

  const profile = await getProfile();
  if (profile) {
    profile.balance = round2(profile.balance - amount);
    await saveProfile(profile);
  }
}

// ---------------- Spoilance logs ----------------
export async function getSpoilanceLogs(): Promise<SpoilanceLog[]> {
  return loadJSON<SpoilanceLog[]>(K.logs, []);
}

export async function addSpoilanceLog(
  items: SpoilanceItem[],
  now: Date = new Date(),
): Promise<void> {
  const total = items.reduce((s, i) => s + (Number(i.cost) || 0), 0);
  const log: SpoilanceLog = {
    id: uid(),
    dateKey: todayKey(now),
    items,
    total,
    timestamp: now.toISOString(),
    monthKey: monthKeyOf(now),
  };
  const all = await getSpoilanceLogs();
  all.push(log);
  await saveJSON(K.logs, all);

  const profile = await getProfile();
  if (profile) {
    profile.spoilance = round2(profile.spoilance - total);
    await saveProfile(profile);
  }
}

// ---------------- Balance edits ----------------
export async function setBalances(balance: number, spoilance: number): Promise<void> {
  const p = await getProfile();
  if (!p) return;
  p.balance = balance;
  p.spoilance = spoilance;
  await saveProfile(p);
}

export async function moveSpoilanceToBalance(amount: number): Promise<void> {
  const p = await getProfile();
  if (!p) return;
  const amt = Math.min(amount, p.spoilance);
  p.spoilance = round2(p.spoilance - amt);
  p.balance = round2(p.balance + amt);
  await saveProfile(p);
}

// ---------------- Snapshots / History ----------------
export async function getSnapshots(): Promise<MonthSnapshot[]> {
  return loadJSON<MonthSnapshot[]>(K.snapshots, []);
}

export async function getLastMonthSavings(): Promise<MonthSnapshot | null> {
  const snaps = await getSnapshots();
  if (snaps.length === 0) return null;
  return snaps.slice().sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1))[0];
}

// Core month-close routine, shared by auto reset and forced (test) close.
async function closeMonth(p: Profile, newMonthKey: string, now: Date): Promise<void> {
  const prevMonth = p.monthKey;
  const entries = await getEntries();
  const logs = await getSpoilanceLogs();
  const monthEntries = entries.filter((e) => e.monthKey === prevMonth);
  const monthLogs = logs.filter((l) => l.monthKey === prevMonth);

  const totalLimit = monthEntries.reduce((s, e) => s + e.limit, 0);
  const totalSpent = monthEntries.reduce((s, e) => s + e.amount, 0);
  const spoilanceSpent = monthLogs.reduce((s, l) => s + l.total, 0);
  const spoilanceLeftover = Math.max(0, p.spoilance);

  const snapshot: MonthSnapshot = {
    monthKey: prevMonth,
    savings: round2(Math.max(0, p.balance) + spoilanceLeftover),
    spoilanceLimit: p.spoilanceLimit,
    spoilanceSpent,
    spoilanceLeftover,
    totalLimit,
    totalSpent,
    closedAt: now.toISOString(),
  };

  const snaps = await getSnapshots();
  if (!snaps.find((s) => s.monthKey === prevMonth)) {
    snaps.push(snapshot);
    await saveJSON(K.snapshots, snaps);
  }

  // Start fresh month: balance resets from stipend (spoilance carved out again).
  p.balance = round2(p.stipend - p.spoilanceLimit);
  p.spoilance = p.spoilanceLimit;
  p.monthKey = newMonthKey;
  await saveProfile(p);
}

// Auto reset when the calendar month has rolled over.
export async function performMonthlyResetIfNeeded(now: Date = new Date()): Promise<boolean> {
  const p = await getProfile();
  if (!p || !p.onboarded) return false;
  const current = monthKeyOf(now);
  if (p.monthKey === current) return false;
  await closeMonth(p, current, now);
  return true;
}

// Forced month-end (developer / QA "time travel"): closes the current tracked
// month and advances to the next month regardless of the real date.
export async function forceMonthEnd(now: Date = new Date()): Promise<boolean> {
  const p = await getProfile();
  if (!p || !p.onboarded) return false;
  const newKey = nextMonthKey(p.monthKey);
  await closeMonth(p, newKey, now);
  return true;
}

// ---------------- Advisor cache ----------------
export async function getAdvisorResult(): Promise<any | null> {
  return loadJSON<any | null>(K.advisor, null);
}

export async function saveAdvisorResult(result: any): Promise<void> {
  await saveJSON(K.advisor, result);
}

// ---------------- Reset all (settings) ----------------
export async function wipeAllData(): Promise<void> {
  await storage.removeItem(K.profile);
  await storage.removeItem(K.templates);
  await storage.removeItem(K.entries);
  await storage.removeItem(K.logs);
  await storage.removeItem(K.snapshots);
  await storage.removeItem(K.advisor);
}
