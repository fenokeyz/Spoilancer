import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";

import { AppText, ScreenBackground, GlassCard, PrimaryButton, GhostButton } from "@/src/components/ui";
import { LabeledInput, formatTime } from "@/src/components/fields";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { formatMoney } from "@/src/utils/money";
import {
  weekdayIndex,
  getTemplatesForDay,
  getEntriesForDate,
  todayKey,
  logExpense,
  ExpenseField,
  WEEKDAYS,
} from "@/src/store/finance";
import { useToast } from "@/src/components/Toast";
import {
  isSmsSupported,
  ensureSmsPermission,
  openSmsSettings,
  getRecentTxns,
  startAutoParse,
  ParsedTxn,
} from "@/src/utils/smsReader";

// Offline parser: pulls the first rupee amount out of a bank/UPI SMS.
function parseAmount(text: string): number | null {
  const cleaned = text.replace(/,/g, "");
  const patterns = [
    /(?:rs\.?|inr|₹)\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
    /([0-9]+(?:\.[0-9]{1,2})?)\s*(?:rs\.?|inr)/i,
    /(?:debited|spent|paid|debit)[^0-9]*([0-9]+(?:\.[0-9]{1,2})?)/i,
  ];
  for (const p of patterns) {
    const m = cleaned.match(p);
    if (m) return parseFloat(m[1]);
  }
  return null;
}

export default function ParseSms() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [sms, setSms] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [fields, setFields] = useState<ExpenseField[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const supported = isSmsSupported();
  const [autoOn, setAutoOn] = useState(false);
  const [recent, setRecent] = useState<ParsedTxn[]>([]);
  const stopRef = useRef<(() => void) | null>(null);

  const load = useCallback(async () => {
    const day = await getTemplatesForDay(weekdayIndex());
    const logged = new Set((await getEntriesForDate(todayKey())).map((e) => e.fieldId));
    setFields(day.filter((f) => !logged.has(f.id)));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    return () => {
      if (stopRef.current) stopRef.current();
    };
  }, []);

  function applyAmount(amt: number) {
    setAmount(amt);
    if (fields.length > 0) setSelected(fields[0].id);
    toast.show(`Detected ${formatMoney(amt)}`, "success");
  }

  async function enableAuto() {
    const status = await ensureSmsPermission();
    if (status === "granted") {
      setAutoOn(true);
      const rows = await getRecentTxns(15);
      setRecent(rows);
      stopRef.current = startAutoParse((t) => {
        setRecent((prev) => [t, ...prev].slice(0, 30));
        if (t.amount) applyAmount(t.amount);
      });
      toast.show("Auto-detect on — new bank SMS will appear here", "success");
    } else if (status === "blocked") {
      toast.show("SMS permission blocked — opening settings", "error");
      openSmsSettings();
    } else if (status === "unsupported") {
      toast.show("Auto-detect needs a real Android build", "info");
    } else {
      toast.show("SMS permission needed for auto-detect", "error");
    }
  }

  function parse() {
    const amt = parseAmount(sms);
    if (amt === null) {
      toast.show("Couldn't find an amount in that message.", "error");
      setAmount(null);
      return;
    }
    applyAmount(amt);
  }

  async function logIt() {
    if (amount === null) return toast.show("Detect or paste an amount first.", "error");
    const field = fields.find((f) => f.id === selected);
    if (!field) return toast.show("Choose which expense this was for.", "error");
    await logExpense(field, amount, "sms");
    toast.show("Logged from SMS ✦", "success");
    router.back();
  }

  return (
    <ScreenBackground>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <AppText variant="heading">Bank SMS</AppText>
        <Pressable testID="sms-close" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.onSurfaceSecondary} />
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing["3xl"] }}
      >
        {/* Auto-detect (Android native) */}
        <GlassCard style={{ gap: spacing.md }}>
          <View style={styles.autoHeader}>
            <View style={styles.iconRow}>
              <Ionicons name="flash" size={18} color={colors.brand} />
              <AppText variant="label">Auto-detect</AppText>
            </View>
            {autoOn ? (
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <AppText variant="caption" style={{ color: colors.success }}>Live</AppText>
              </View>
            ) : null}
          </View>

          {supported ? (
            autoOn ? (
              <AppText variant="caption" style={{ lineHeight: 16 }}>
                Watching for bank & UPI debit messages. Tap one below to log it in a tap.
              </AppText>
            ) : (
              <>
                <AppText variant="caption" style={{ lineHeight: 16 }}>
                  Read incoming bank/UPI debit SMS automatically and turn them into expenses.
                </AppText>
                <PrimaryButton
                  testID="sms-enable-auto"
                  label="Turn on auto-detect"
                  onPress={enableAuto}
                  icon={<Ionicons name="flash" size={18} color={colors.onBrandPrimary} />}
                />
              </>
            )
          ) : (
            <AppText variant="caption" style={{ lineHeight: 16 }} testID="sms-auto-unsupported">
              Automatic bank-SMS reading runs on a real Android build (not Expo Go / web). You can still paste a message below.
            </AppText>
          )}

          {autoOn && recent.length > 0
            ? recent.map((t, i) => (
                <Pressable
                  key={`${t.timestamp}-${i}`}
                  testID={`sms-recent-${i}`}
                  onPress={() => t.amount && applyAmount(t.amount)}
                  style={styles.recentRow}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="label">{t.bankCode || "Bank"} · {t.channel || "debit"}</AppText>
                    <AppText variant="caption">{new Date(t.timestamp).toLocaleString()}</AppText>
                  </View>
                  <AppText variant="mono" style={{ color: colors.error }}>-{formatMoney(t.amount || 0)}</AppText>
                </Pressable>
              ))
            : null}
          {autoOn && recent.length === 0 ? (
            <AppText variant="caption" style={{ color: colors.onSurfaceTertiary }}>
              No recent transaction SMS found yet.
            </AppText>
          ) : null}
        </GlassCard>

        {/* Manual paste */}
        <AppText variant="heading" style={styles.section}>Or paste a message</AppText>
        <LabeledInput
          testID="sms-input"
          label="Bank / UPI message"
          value={sms}
          onChangeText={setSms}
          placeholder="e.g. Rs 250 debited from A/c XX34 via UPI to Cafe…"
          multiline
        />
        <GhostButton testID="sms-parse-button" label="Detect amount" onPress={parse} icon={<Ionicons name="scan-outline" size={18} color={colors.onSurface} />} />

        {amount !== null ? (
          <>
            <GlassCard style={styles.detectedCard}>
              <AppText variant="caption" style={styles.detectedLabel}>Detected amount</AppText>
              <AppText variant="mono" style={styles.detectedValue}>{formatMoney(amount)}</AppText>
            </GlassCard>

            <AppText variant="heading" style={styles.section}>Map to today's expense</AppText>
            {fields.length === 0 ? (
              <AppText variant="bodyMuted" style={{ lineHeight: 20 }}>
                No unlogged expenses for {WEEKDAYS[weekdayIndex()]}. Add one in Daily Limits first.
              </AppText>
            ) : (
              fields.map((f) => {
                const active = selected === f.id;
                return (
                  <Pressable
                    key={f.id}
                    testID={`sms-field-${f.id}`}
                    onPress={() => setSelected(f.id)}
                    style={[styles.fieldRow, active && styles.fieldRowActive]}
                  >
                    <Ionicons
                      name={active ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={active ? colors.brand : colors.onSurfaceTertiary}
                    />
                    <View style={{ flex: 1 }}>
                      <AppText variant="label">{f.title}</AppText>
                      <AppText variant="caption">{formatTime(f.hour, f.minute)} · limit {formatMoney(f.amount)}</AppText>
                    </View>
                  </Pressable>
                );
              })
            )}

            <PrimaryButton testID="sms-log-button" label="Log this expense" onPress={logIt} style={{ marginTop: spacing.lg }} />
          </>
        ) : null}
      </KeyboardAwareScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  autoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  iconRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  recentRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  detectedCard: { marginTop: spacing.xl, alignItems: "center" },
  detectedLabel: { textTransform: "uppercase", letterSpacing: 2, color: colors.brand },
  detectedValue: { fontFamily: fonts.displayBlack, fontSize: 40, color: colors.onSurface, marginTop: spacing.xs },
  section: { marginTop: spacing["2xl"], marginBottom: spacing.md },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, marginBottom: spacing.md },
  fieldRowActive: { borderColor: colors.brand },
});
