import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { AppText, ScreenBackground, GlassCard } from "@/src/components/ui";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { formatMoney } from "@/src/utils/money";
import {
  getSnapshots,
  getEntries,
  getSpoilanceLogs,
  getProfile,
  monthKeyOf,
  MonthSnapshot,
  ExpenseEntry,
  Profile,
} from "@/src/store/finance";

const TEXTURE = "https://images.unsplash.com/photo-1578662996442-48f60103fc96?crop=entropy&cs=srgb&fm=jpg&q=85&w=800";

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

interface DayGroup {
  dateKey: string;
  spent: number;
  limit: number;
  leftover: number;
}

export default function History() {
  const insets = useSafeAreaInsets();
  const [snapshots, setSnapshots] = useState<MonthSnapshot[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [days, setDays] = useState<DayGroup[]>([]);
  const [monthSpoilanceSpent, setMonthSpoilanceSpent] = useState(0);

  const load = useCallback(async () => {
    const [snaps, entries, logs, p] = await Promise.all([
      getSnapshots(),
      getEntries(),
      getSpoilanceLogs(),
      getProfile(),
    ]);
    setProfile(p);
    setSnapshots(snaps.slice().reverse());

    const mk = monthKeyOf();
    const monthEntries = entries.filter((e) => e.monthKey === mk);
    const grouped: Record<string, DayGroup> = {};
    monthEntries.forEach((e: ExpenseEntry) => {
      if (!grouped[e.dateKey]) grouped[e.dateKey] = { dateKey: e.dateKey, spent: 0, limit: 0, leftover: 0 };
      grouped[e.dateKey].spent += e.amount;
      grouped[e.dateKey].limit += e.limit;
      grouped[e.dateKey].leftover += e.leftover;
    });
    setDays(Object.values(grouped).sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1)));
    setMonthSpoilanceSpent(logs.filter((l) => l.monthKey === mk).reduce((s, l) => s + l.total, 0));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const allTimeSavings = snapshots.reduce((s, m) => s + m.savings, 0);
  const allTimeSpoilance = snapshots.reduce((s, m) => s + m.spoilanceSpent, 0);
  const hasData = days.length > 0 || snapshots.length > 0;

  return (
    <ScreenBackground>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 140 }}>
        <AppText variant="title" style={styles.title}>History</AppText>

        {/* All-time totals */}
        <View style={styles.allTimeRow}>
          <GlassCard style={styles.allTimeCard}>
            <Ionicons name="shield-checkmark" size={18} color={colors.success} />
            <AppText variant="caption" style={styles.atLabel}>All-time savings</AppText>
            <AppText variant="mono" style={{ color: colors.success, fontSize: fontSize.xl }}>
              {formatMoney(allTimeSavings)}
            </AppText>
          </GlassCard>
          <GlassCard style={styles.allTimeCard}>
            <Ionicons name="sparkles" size={18} color={colors.brand} />
            <AppText variant="caption" style={styles.atLabel}>All-time spoilance</AppText>
            <AppText variant="mono" style={{ color: colors.brand, fontSize: fontSize.xl }}>
              {formatMoney(allTimeSpoilance)}
            </AppText>
          </GlassCard>
        </View>

        {/* This month in progress */}
        {profile ? (
          <>
            <AppText variant="heading" style={styles.section}>This month · {monthLabel(monthKeyOf())}</AppText>
            <GlassCard style={{ gap: spacing.md, marginHorizontal: spacing.xl }}>
              <SummaryRow label="Current savings" value={formatMoney(profile.savings)} color={colors.success} />
              <SummaryRow label="Current spoilance" value={formatMoney(profile.spoilance)} color={colors.brand} />
              <View style={styles.divider} />
              <SummaryRow label="Spoilance spent" value={formatMoney(monthSpoilanceSpent)} />
              <View style={styles.badge}>
                <View style={styles.dot} />
                <AppText variant="caption" style={{ color: colors.onSurfaceSecondary }}>In progress · closes month-end</AppText>
              </View>
            </GlassCard>
          </>
        ) : null}

        {/* Past months */}
        {snapshots.length > 0 ? (
          <>
            <AppText variant="heading" style={styles.section}>Past months</AppText>
            {snapshots.map((s) => (
              <GlassCard key={s.monthKey} style={{ gap: spacing.sm, marginBottom: spacing.md, marginHorizontal: spacing.xl }}>
                <View style={styles.monthHeader}>
                  <AppText variant="displaySemi" style={{ fontSize: fontSize.xl }}>{monthLabel(s.monthKey)}</AppText>
                </View>
                <SummaryRow label="Saved" value={formatMoney(s.savings)} color={colors.success} />
                <SummaryRow label="Spoilance spent" value={formatMoney(s.spoilanceSpent)} color={colors.brand} />
                <SummaryRow label="Leftover → savings" value={formatMoney(s.spoilanceLeftover)} />
              </GlassCard>
            ))}
          </>
        ) : null}

        {/* Daily activity */}
        <AppText variant="heading" style={styles.section}>Daily activity</AppText>
        {days.length > 0 ? (
          days.map((d) => {
            const over = d.spent > d.limit;
            return (
              <GlassCard key={d.dateKey} style={styles.dayRow}>
                <View style={{ flex: 1 }}>
                  <AppText variant="label">
                    {new Date(d.dateKey).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                  </AppText>
                  <AppText variant="caption" style={{ marginTop: 2 }}>
                    Spent {formatMoney(d.spent)} of {formatMoney(d.limit)}
                  </AppText>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <AppText variant="mono" style={{ color: over ? colors.error : colors.success, fontSize: fontSize.lg }}>
                    {over ? "" : "+"}{formatMoney(d.leftover)}
                  </AppText>
                  <AppText variant="caption">{over ? "over limit" : "to spoilance"}</AppText>
                </View>
              </GlassCard>
            );
          })
        ) : (
          <View style={styles.empty}>
            <Image source={{ uri: TEXTURE }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={styles.emptyScrim} />
            <Ionicons name="receipt-outline" size={32} color={colors.onSurfaceTertiary} />
            <AppText variant="bodyMuted" style={{ marginTop: spacing.md }}>No spending logged yet this month.</AppText>
          </View>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.summaryRow}>
      <AppText variant="body" style={{ color: colors.onSurfaceSecondary }}>{label}</AppText>
      <AppText variant="mono" style={{ color: color || colors.onSurface, fontSize: fontSize.lg }}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: spacing.xl, fontSize: fontSize["4xl"] },
  allTimeRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.xl, marginTop: spacing.lg },
  allTimeCard: { flex: 1, gap: 6 },
  atLabel: { textTransform: "uppercase", letterSpacing: 1 },
  section: { paddingHorizontal: 0, marginHorizontal: spacing.xl, marginTop: spacing["2xl"], marginBottom: spacing.md },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  divider: { height: 1, backgroundColor: colors.divider },
  badge: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning },
  monthHeader: { marginBottom: spacing.xs },
  dayRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md, marginHorizontal: spacing.xl },
  empty: {
    marginHorizontal: spacing.xl,
    height: 180,
    borderRadius: radius.lg,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(11,11,14,0.78)" },
});
