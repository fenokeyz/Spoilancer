import React, { useMemo, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";

import { AppText, ScreenBackground, PrimaryButton } from "@/src/components/ui";
import { AnimatedMoney } from "@/src/components/AnimatedMoney";
import { LabeledInput } from "@/src/components/fields";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { addSpoilanceLog, getProfile } from "@/src/store/finance";
import { useToast } from "@/src/components/Toast";

interface Row {
  name: string;
  cost: string;
}

export default function SpoilanceLogger() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [phase, setPhase] = useState<"count" | "items">("count");
  const [countStr, setCountStr] = useState("1");
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const total = useMemo(
    () => rows.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0),
    [rows],
  );

  function startItems() {
    const n = Math.max(1, Math.min(20, parseInt(countStr, 10) || 1));
    setRows(Array.from({ length: n }, () => ({ name: "", cost: "" })));
    setPhase("items");
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => (prev.length >= 20 ? prev : [...prev, { name: "", cost: "" }]));
  }

  async function save() {
    const items = rows
      .map((r) => ({ name: r.name.trim() || "Item", cost: parseFloat(r.cost) || 0 }))
      .filter((i) => i.cost > 0);
    if (items.length === 0) {
      toast.show("Add at least one item with a cost.", "error");
      return;
    }
    setSaving(true);
    const profile = await getProfile();
    await addSpoilanceLog(items);
    setSaving(false);
    const remaining = (profile?.spoilance ?? 0) - total;
    if (remaining < 0) {
      toast.show("Logged — you've gone over your spoilance!", "info");
    } else {
      toast.show("Spoilance logged ✦", "success");
    }
    router.back();
  }

  return (
    <ScreenBackground>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <AppText variant="heading">Log Spoilance</AppText>
        <Pressable testID="logger-close" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.onSurfaceSecondary} />
        </Pressable>
      </View>

      {phase === "count" ? (
        <View style={styles.countWrap}>
          <AppText variant="caption" style={styles.kicker}>Splurge session</AppText>
          <AppText variant="title" style={styles.countTitle}>How many things did you spoil yourself with?</AppText>

          <View style={styles.stepper}>
            <Pressable
              testID="count-minus"
              onPress={() => setCountStr((c) => String(Math.max(1, (parseInt(c, 10) || 1) - 1)))}
              style={styles.stepBtn}
            >
              <Ionicons name="remove" size={26} color={colors.onSurface} />
            </Pressable>
            <AppText variant="display" style={styles.countNum}>{Math.max(1, parseInt(countStr, 10) || 1)}</AppText>
            <Pressable
              testID="count-plus"
              onPress={() => setCountStr((c) => String(Math.min(20, (parseInt(c, 10) || 1) + 1)))}
              style={styles.stepBtn}
            >
              <Ionicons name="add" size={26} color={colors.onSurface} />
            </Pressable>
          </View>

          <PrimaryButton testID="count-continue" label="Continue" onPress={startItems} style={{ marginTop: spacing["3xl"] }} />
        </View>
      ) : (
        <>
          {/* Sticky running total */}
          <View style={styles.totalCard}>
            <LinearGradient colors={[colors.brandTertiary, colors.surfaceSecondary]} style={StyleSheet.absoluteFill} />
            <AppText variant="caption" style={styles.totalLabel}>Running total</AppText>
            <AnimatedMoney testID="running-total" value={total} style={styles.totalValue} />
          </View>

          <KeyboardAwareScrollView
            bottomOffset={110}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing["3xl"] }}
          >
            {rows.map((r, i) => (
              <Animated.View key={i} entering={FadeInDown.delay(i * 30)} style={styles.rowCard}>
                <AppText variant="caption" style={styles.rowIndex}>Item {i + 1}</AppText>
                <LabeledInput
                  testID={`item-name-${i}`}
                  label="What did you buy?"
                  value={r.name}
                  onChangeText={(t) => updateRow(i, { name: t })}
                  placeholder="e.g. New headphones"
                />
                <LabeledInput
                  testID={`item-cost-${i}`}
                  label="Cost"
                  value={r.cost}
                  onChangeText={(t) => updateRow(i, { cost: t.replace(/[^0-9.]/g, "") })}
                  placeholder="0"
                  prefix="₹"
                  keyboardType="numeric"
                />
              </Animated.View>
            ))}
            <Pressable testID="add-item-row" onPress={addRow} style={styles.addRow}>
              <Ionicons name="add-circle-outline" size={20} color={colors.brand} />
              <AppText variant="label" style={{ color: colors.brand }}>Add another item</AppText>
            </Pressable>
          </KeyboardAwareScrollView>

          <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
            <View style={[styles.saveBar, { paddingBottom: insets.bottom + spacing.md }]}>
              <PrimaryButton testID="save-spoilance-button" label={`Log ${rows.length} ${rows.length === 1 ? "item" : "items"}`} onPress={save} loading={saving} />
            </View>
          </KeyboardStickyView>
        </>
      )}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  countWrap: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: "center" },
  kicker: { textTransform: "uppercase", letterSpacing: 3, color: colors.brand, fontFamily: fonts.semibold },
  countTitle: { marginTop: spacing.sm, fontSize: fontSize["3xl"] },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing["2xl"], marginTop: spacing["3xl"] },
  stepBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  countNum: { fontSize: 64, color: colors.brand, minWidth: 80, textAlign: "center" },
  totalCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.brandTertiary,
    padding: spacing.xl,
    alignItems: "center",
  },
  totalLabel: { textTransform: "uppercase", letterSpacing: 2, color: colors.brand },
  totalValue: { fontFamily: fonts.displayBlack, fontSize: 46, color: colors.onSurface, marginTop: spacing.xs },
  rowCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md },
  rowIndex: { textTransform: "uppercase", letterSpacing: 1, color: colors.brand, marginBottom: spacing.md },
  addRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 48 },
  saveBar: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
});
