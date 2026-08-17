import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";

import { AppText, ScreenBackground, GlassCard, PrimaryButton } from "@/src/components/ui";
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

  const load = useCallback(async () => {
    const day = await getTemplatesForDay(weekdayIndex());
    const logged = new Set((await getEntriesForDate(todayKey())).map((e) => e.fieldId));
    setFields(day.filter((f) => !logged.has(f.id)));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function parse() {
    const amt = parseAmount(sms);
    if (amt === null) {
      toast.show("Couldn't find an amount in that message.", "error");
      setAmount(null);
      return;
    }
    setAmount(amt);
    // auto-pick the closest upcoming/earlier field by current time
    if (fields.length > 0) setSelected(fields[0].id);
    toast.show(`Detected ${formatMoney(amt)}`, "success");
  }

  async function logIt() {
    if (amount === null) return toast.show("Parse a message first.", "error");
    const field = fields.find((f) => f.id === selected);
    if (!field) return toast.show("Choose which expense this was for.", "error");
    await logExpense(field, amount, "sms");
    toast.show("Logged from SMS ✦", "success");
    router.back();
  }

  return (
    <ScreenBackground>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <AppText variant="heading">Parse bank SMS</AppText>
        <Pressable testID="sms-close" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.onSurfaceSecondary} />
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing["3xl"] }}
      >
        <View style={styles.infoNote}>
          <Ionicons name="information-circle-outline" size={18} color={colors.onSurfaceSecondary} />
          <AppText variant="caption" style={{ flex: 1, lineHeight: 16 }}>
            Paste a debit / UPI message and we'll pull out the amount offline. Fully-automatic detection needs a native build.
          </AppText>
        </View>

        <LabeledInput
          testID="sms-input"
          label="Bank / UPI message"
          value={sms}
          onChangeText={setSms}
          placeholder="e.g. Rs 250 debited from A/c XX34 via UPI to Cafe…"
          multiline
        />
        <PrimaryButton testID="sms-parse-button" label="Detect amount" onPress={parse} icon={<Ionicons name="scan-outline" size={18} color={colors.onBrandPrimary} />} />

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
  infoNote: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  detectedCard: { marginTop: spacing.xl, alignItems: "center" },
  detectedLabel: { textTransform: "uppercase", letterSpacing: 2, color: colors.brand },
  detectedValue: { fontFamily: fonts.displayBlack, fontSize: 40, color: colors.onSurface, marginTop: spacing.xs },
  section: { marginTop: spacing["2xl"], marginBottom: spacing.md },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, marginBottom: spacing.md },
  fieldRowActive: { borderColor: colors.brand },
});
