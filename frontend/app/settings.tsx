import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, Switch } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { AppText, ScreenBackground, GlassCard, PrimaryButton } from "@/src/components/ui";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { storage } from "@/src/utils/storage";
import { useToast } from "@/src/components/Toast";
import { ensureNotificationPermission, rescheduleReminders } from "@/src/utils/notifications";
import * as Notifications from "expo-notifications";
import {
  getProfile,
  setLeftoverTarget,
  forceMonthEnd,
  LeftoverTarget,
} from "@/src/store/finance";

const REMINDERS_KEY = "spoilancer.reminders_on";

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [remindersOn, setRemindersOn] = useState(true);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [leftoverTarget, setLeftoverTargetState] = useState<LeftoverTarget>("spoilance");

  const load = useCallback(async () => {
    const on = await storage.getItem<boolean>(REMINDERS_KEY, true);
    setRemindersOn(on === null ? true : (on as boolean));
    const p = await getProfile();
    if (p) setLeftoverTargetState(p.leftoverTarget);
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      setScheduledCount(scheduled.length);
    } catch {
      setScheduledCount(0);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function pickLeftoverTarget(t: LeftoverTarget) {
    setLeftoverTargetState(t);
    await setLeftoverTarget(t);
    toast.show(
      t === "spoilance" ? "Daily savings now build your Spoilance" : "Daily savings now stay in your balance",
      "success",
    );
  }

  async function simulateMonthEnd() {
    const ok = await forceMonthEnd();
    if (ok) {
      toast.show("Month closed — check History & Home", "success");
    } else {
      toast.show("Finish onboarding first", "error");
    }
  }

  async function toggleReminders(next: boolean) {
    setRemindersOn(next);
    await storage.setItem(REMINDERS_KEY, next);
    if (next) {
      const granted = await ensureNotificationPermission();
      if (granted) {
        await rescheduleReminders();
        toast.show("Reminders on", "success");
      } else {
        setRemindersOn(false);
        await storage.setItem(REMINDERS_KEY, false);
        toast.show("Allow notifications in system settings", "error");
      }
    } else {
      await Notifications.cancelAllScheduledNotificationsAsync();
      toast.show("Reminders off", "info");
    }
    await load();
  }

  return (
    <ScreenBackground>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="settings-back" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <AppText variant="heading">App settings</AppText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing["3xl"] }}>
        <AppText variant="heading" style={styles.section}>Reminders</AppText>
        <GlassCard style={{ gap: spacing.lg }}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <AppText variant="label">Daily check-in reminders</AppText>
              <AppText variant="caption" style={{ marginTop: 2, lineHeight: 16 }}>
                Nudges at each expense's time, plus an 11 PM catch-up if anything's unlogged.
              </AppText>
            </View>
            <Switch
              testID="reminders-switch"
              value={remindersOn}
              onValueChange={toggleReminders}
              trackColor={{ true: colors.brand, false: colors.surfaceTertiary }}
              thumbColor={colors.onSurface}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.rowBetween}>
            <AppText variant="caption">Scheduled notifications</AppText>
            <AppText variant="label" style={{ color: colors.brand }}>{scheduledCount}</AppText>
          </View>
        </GlassCard>

        <AppText variant="heading" style={styles.section}>Money flow</AppText>
        <GlassCard style={{ gap: spacing.md }}>
          <AppText variant="caption" style={{ lineHeight: 16 }}>
            When you spend under a daily limit, where should the money you saved go?
          </AppText>
          <View style={styles.segment}>
            <Pressable
              testID="leftover-spoilance"
              onPress={() => pickLeftoverTarget("spoilance")}
              style={[styles.segmentBtn, leftoverTarget === "spoilance" && styles.segmentBtnActive]}
            >
              <Ionicons name="sparkles" size={16} color={leftoverTarget === "spoilance" ? colors.onBrandPrimary : colors.onSurfaceSecondary} />
              <AppText variant="label" style={{ color: leftoverTarget === "spoilance" ? colors.onBrandPrimary : colors.onSurfaceSecondary }}>
                Spoilance
              </AppText>
            </Pressable>
            <Pressable
              testID="leftover-savings"
              onPress={() => pickLeftoverTarget("savings")}
              style={[styles.segmentBtn, leftoverTarget === "savings" && styles.segmentBtnActive]}
            >
              <Ionicons name="wallet" size={16} color={leftoverTarget === "savings" ? colors.onBrandPrimary : colors.onSurfaceSecondary} />
              <AppText variant="label" style={{ color: leftoverTarget === "savings" ? colors.onBrandPrimary : colors.onSurfaceSecondary }}>
                Savings
              </AppText>
            </Pressable>
          </View>
        </GlassCard>

        <AppText variant="heading" style={styles.section}>Appearance</AppText>
        <GlassCard style={styles.rowBetween}>
          <View style={styles.iconRow}>
            <Ionicons name="moon" size={20} color={colors.brand} />
            <AppText variant="body">Dark (Luxe)</AppText>
          </View>
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
        </GlassCard>

        <AppText variant="heading" style={styles.section}>Month & privacy</AppText>
        <GlassCard style={{ gap: spacing.md }}>
          <InfoRow icon="refresh-outline" title="Monthly reset" text="At month-end, leftover spoilance rolls into savings and a fresh month begins automatically." />
          <View style={styles.divider} />
          <InfoRow icon="lock-closed-outline" title="On-device only" text="All budgets, limits and history stay on this phone. Only AI analysis is sent securely — and never stored." />
        </GlassCard>

        <AppText variant="heading" style={styles.section}>Developer</AppText>
        <GlassCard style={{ gap: spacing.md }}>
          <InfoRow icon="time-outline" title="Simulate month-end" text="Time-travel: close this month now, roll leftover spoilance into savings, and start a fresh month. Use it to preview History." />
          <PrimaryButton testID="simulate-month-end" label="Close current month (test)" onPress={simulateMonthEnd} />
        </GlassCard>

        <AppText variant="caption" style={styles.footer}>Spoilancer · v1.0</AppText>
      </ScrollView>
    </ScreenBackground>
  );
}

function InfoRow({ icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color={colors.brand} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="caption" style={{ marginTop: 2, lineHeight: 16 }}>{text}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  section: { marginTop: spacing["2xl"], marginBottom: spacing.md },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  divider: { height: 1, backgroundColor: colors.divider },
  infoRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  segment: { flexDirection: "row", gap: spacing.md },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  footer: { textAlign: "center", marginTop: spacing["2xl"] },
});
