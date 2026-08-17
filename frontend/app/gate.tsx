import React, { useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";

import { AppText, PrimaryButton, ScreenBackground, GlassCard } from "@/src/components/ui";
import { LabeledInput, formatTime } from "@/src/components/fields";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { formatMoney } from "@/src/utils/money";
import { getPendingFields, logExpense, ExpenseField, WEEKDAYS } from "@/src/store/finance";
import { useToast } from "@/src/components/Toast";

export default function Gate() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [pending, setPending] = useState<ExpenseField[] | null>(null);
  const [amount, setAmount] = useState("");
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      const p = await getPendingFields();
      setPending(p);
      setTotal(p.length);
      if (p.length === 0) router.replace("/(tabs)/home");
    })();
  }, []);

  async function submit() {
    if (!pending || pending.length === 0) return;
    const spent = parseFloat(amount);
    if (isNaN(spent) || spent < 0) {
      toast.show("Enter a valid amount (0 or more).", "error");
      return;
    }
    const field = pending[0];
    await logExpense(field, spent, "gate");
    const rest = pending.slice(1);
    setAmount("");
    if (rest.length === 0) {
      toast.show("All caught up ✦", "success");
      router.replace("/(tabs)/home");
    } else {
      setPending(rest);
    }
  }

  if (pending === null) {
    return (
      <ScreenBackground>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </ScreenBackground>
    );
  }

  if (pending.length === 0) return <ScreenBackground><View style={styles.loading}><ActivityIndicator color={colors.brand} /></View></ScreenBackground>;

  const field = pending[0];
  const done = total - pending.length;
  const leftover = (parseFloat(amount) || 0) <= field.amount;

  return (
    <ScreenBackground>
      <KeyboardAwareScrollView
        bottomOffset={40}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing["3xl"], paddingBottom: insets.bottom + spacing.xl }]}
      >
        <View style={styles.lockRow}>
          <Ionicons name="lock-closed" size={16} color={colors.warning} />
          <AppText variant="caption" style={{ color: colors.warning, textTransform: "uppercase", letterSpacing: 2 }}>
            Log to unlock
          </AppText>
        </View>

        <AppText variant="title" style={styles.title}>Before you continue…</AppText>
        <AppText variant="bodyMuted" style={styles.sub}>
          You have {pending.length} unlogged {pending.length === 1 ? "expense" : "expenses"} from today. Fill them in to reach Home.
        </AppText>

        {/* Stacked deck illusion */}
        <View style={styles.deck}>
          {pending.length > 2 ? <View style={[styles.ghostCard, { bottom: -16, left: 16, right: 16, opacity: 0.4 }]} /> : null}
          {pending.length > 1 ? <View style={[styles.ghostCard, { bottom: -8, left: 8, right: 8, opacity: 0.7 }]} /> : null}

          <Animated.View key={field.id} entering={FadeInDown.springify().damping(16)} exiting={FadeOut}>
            <GlassCard style={{ gap: spacing.md }}>
              <View style={styles.cardTop}>
                <AppText variant="caption" style={{ color: colors.brand, textTransform: "uppercase", letterSpacing: 1 }}>
                  {WEEKDAYS[field.weekday]} · {formatTime(field.hour, field.minute)}
                </AppText>
                <AppText variant="caption">{done + 1} of {total}</AppText>
              </View>
              <AppText variant="displaySemi">How much on {field.title}?</AppText>
              {field.description ? (
                <AppText variant="bodyMuted">{field.description}</AppText>
              ) : null}
              <View style={styles.limitPill}>
                <AppText variant="caption" style={{ color: colors.onSurfaceSecondary }}>
                  Your limit: {formatMoney(field.amount)}
                </AppText>
              </View>

              <LabeledInput
                testID="gate-amount-input"
                label="Amount spent"
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                prefix="₹"
                keyboardType="numeric"
                money
                autoFocus
              />
              {amount ? (
                <AppText variant="caption" style={{ color: leftover ? colors.success : colors.error }}>
                  {leftover
                    ? `+${formatMoney(field.amount - (parseFloat(amount) || 0))} into Spoilance`
                    : `${formatMoney((parseFloat(amount) || 0) - field.amount)} over your limit`}
                </AppText>
              ) : null}
            </GlassCard>
          </Animated.View>
        </View>

        <PrimaryButton
          testID="gate-submit-button"
          label={pending.length === 1 ? "Log & unlock" : "Log & next"}
          onPress={submit}
          style={{ marginTop: spacing["2xl"] }}
        />
      </KeyboardAwareScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { paddingHorizontal: spacing.xl, flexGrow: 1 },
  lockRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { marginTop: spacing.md, fontSize: fontSize["4xl"] },
  sub: { marginTop: spacing.sm, lineHeight: 22, fontSize: fontSize.lg },
  deck: { marginTop: spacing["2xl"] },
  ghostCard: {
    position: "absolute",
    height: 80,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  limitPill: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
});
