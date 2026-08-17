// Spoilancer local-first data layer. All financial data lives on-device.
// Objects are persisted as JSON strings via the storage util.

import { storage } from "@/src/utils/storage";

// ---------------- Types ----------------
export interface Profile {
  name: string;
  email: string;
  currency: string;
  stipend: number;
  savings: number;
  spoilance: number; // current available splurge balance
  spoilanceLimit: number; // monthly allocated splurge budget
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

// ---------------- Profile ----------------
export async function getProfile(): Promise<Profile | null> {
  return loadJSON<Profile | null>(K.profile, null);
}

export async function saveProfile(p: Profile): Promise<void> {
  await saveJSON(K.profile, p);
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

// Log an actual spend for a field. Leftover flows into spoilance balance.
export async function logExpense(
  field: ExpenseField,
  spent: number,
  source: ExpenseEntry["source"] = "manual",
  now: Date = new Date(),
): Promise<void> {
  const leftover = field.amount - spent;
  const entry: ExpenseEntry = {
    id: uid(),
    fieldId: field.id,
    title: field.title,
    dateKey: todayKey(now),
    weekday: field.weekday,
    limit: field.amount,
    amount: spent,
    leftover,
    source,
    timestamp: now.toISOString(),
    monthKey: monthKeyOf(now),
  };
  const all = await getEntries();
  all.push(entry);
  await saveJSON(K.entries, all);

  const profile = await getProfile();
  if (profile) {
    profile.spoilance = Math.round((profile.spoilance + leftover) * 100) / 100;
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
    profile.spoilance = Math.round((profile.spoilance - total) * 100) / 100;
    await saveProfile(profile);
  }
}

// ---------------- Balance edits ----------------
export async function setBalances(savings: number, spoilance: number): Promise<void> {
  const p = await getProfile();
  if (!p) return;
  p.savings = savings;
  p.spoilance = spoilance;
  await saveProfile(p);
}

export async function moveSpoilanceToSavings(amount: number): Promise<void> {
  const p = await getProfile();
  if (!p) return;
  const amt = Math.min(amount, p.spoilance);
  p.spoilance = Math.round((p.spoilance - amt) * 100) / 100;
  p.savings = Math.round((p.savings + amt) * 100) / 100;
  await saveProfile(p);
}

// ---------------- Snapshots / History ----------------
export async function getSnapshots(): Promise<MonthSnapshot[]> {
  return loadJSON<MonthSnapshot[]>(K.snapshots, []);
}

export interface AllTimeTotals {
  savings: number;
  spoilance: number;
}

export async function getAllTimeTotals(): Promise<AllTimeTotals> {
  const snaps = await getSnapshots();
  return {
    savings: snaps.reduce((s, m) => s + m.savings, 0),
    spoilance: snaps.reduce((s, m) => s + m.spoilanceSpent, 0),
  };
}

// Monthly reset: close previous month, move leftover spoilance -> savings, start fresh month.
export async function performMonthlyResetIfNeeded(now: Date = new Date()): Promise<boolean> {
  const p = await getProfile();
  if (!p || !p.onboarded) return false;
  const current = monthKeyOf(now);
  if (p.monthKey === current) return false;

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
    savings: Math.round((p.savings + spoilanceLeftover) * 100) / 100,
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

  // Roll forward: leftover spoilance becomes savings; spoilance resets to its allocation.
  p.savings = Math.round((p.savings + spoilanceLeftover) * 100) / 100;
  p.spoilance = p.spoilanceLimit;
  p.monthKey = current;
  await saveProfile(p);
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
