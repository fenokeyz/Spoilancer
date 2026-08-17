import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, Modal } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { AppText, ScreenBackground, GlassCard, PrimaryButton, GhostButton } from "@/src/components/ui";
import { AnimatedMoney } from "@/src/components/AnimatedMoney";
import { LabeledInput } from "@/src/components/fields";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { formatMoney } from "@/src/utils/money";
import {
  getProfile,
  Profile,
  getEntriesForDate,
  todayKey,
  getTemplatesForDay,
  weekdayIndex,
  setBalances,
  moveSpoilanceToSavings,
} from "@/src/store/finance";
import { useToast } from "@/src/components/Toast";

const WAVE = "https://images.unsplash.com/photo-1710438399422-2fca27686bcd?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [todayLogged, setTodayLogged] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [todayLeftover, setTodayLeftover] = useState(0);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    const p = await getProfile();
    setProfile(p);
    const entries = await getEntriesForDate(todayKey());
    const dayFields = await getTemplatesForDay(weekdayIndex());
    setTodayLogged(entries.length);
    setTodayTotal(dayFields.length);
    setTodayLeftover(entries.reduce((s, e) => s + e.leftover, 0));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!profile) {
    return (
      <ScreenBackground>
        <View style={styles.loading}>
          <AppText variant="bodyMuted">Loading…</AppText>
        </View>
      </ScreenBackground>
    );
  }

  const firstName = (profile.name || "You").split(" ")[0];

  return (
    <ScreenBackground>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 140 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <AppText variant="caption" style={styles.kicker}>
              {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
            </AppText>
            <AppText variant="title" style={styles.hello}>Hi, {firstName}</AppText>
          </View>
          <Pressable testID="profile-avatar" onPress={() => router.push("/(tabs)/profile")} style={styles.avatar}>
            <AppText variant="heading" style={{ color: colors.onBrandPrimary }}>
              {firstName.charAt(0).toUpperCase()}
            </AppText>
          </Pressable>
        </View>

        {/* Hero cards */}
        <View style={styles.heroWrap}>
          <View style={styles.heroCard}>
            <Image source={{ uri: WAVE }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient
              colors={["rgba(11,11,14,0.4)", "rgba(11,11,14,0.9)"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroContent}>
              <View style={styles.heroRow}>
                <View style={styles.heroBlock}>
                  <View style={styles.heroLabelRow}>
                    <Ionicons name="shield-checkmark" size={15} color={colors.success} />
                    <AppText variant="caption" style={styles.heroLabel}>Savings</AppText>
                  </View>
                  <AnimatedMoney
                    testID="home-savings-value"
                    value={profile.savings}
                    currency={profile.currency}
                    style={styles.savingsValue}
                  />
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroBlock}>
                  <View style={styles.heroLabelRow}>
                    <Ionicons name="sparkles" size={15} color={colors.brand} />
                    <AppText variant="caption" style={styles.heroLabel}>Spoilance</AppText>
                  </View>
                  <AnimatedMoney
                    testID="home-spoilance-value"
                    value={profile.spoilance}
                    currency={profile.currency}
                    style={styles.spoilanceValue}
                  />
                </View>
              </View>
              <Pressable testID="edit-balances-button" onPress={() => setEditOpen(true)} style={styles.editBalances}>
                <Ionicons name="options-outline" size={16} color={colors.onSurface} />
                <AppText variant="caption" style={{ color: colors.onSurface }}>Adjust balances</AppText>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Today status */}
        <GlassCard style={styles.todayCard}>
          <View style={{ flex: 1 }}>
            <AppText variant="label">Today's check-ins</AppText>
            <AppText variant="caption" style={{ marginTop: 2 }}>
              {todayLogged}/{todayTotal} logged · {formatMoney(todayLeftover)} earned to Spoilance
            </AppText>
          </View>
          <Ionicons
            name={todayTotal > 0 && todayLogged >= todayTotal ? "checkmark-circle" : "ellipse-outline"}
            size={26}
            color={todayTotal > 0 && todayLogged >= todayTotal ? colors.success : colors.onSurfaceTertiary}
          />
        </GlassCard>

        {/* Quick actions */}
        <AppText variant="heading" style={styles.sectionTitle}>Quick actions</AppText>
        <View style={styles.grid}>
          <ActionCard
            testID="action-edit-limits"
            icon="create-outline"
            title="Daily Limits"
            subtitle="Edit each day"
            onPress={() => router.push("/limits")}
          />
          <ActionCard
            testID="action-advisor"
            icon="bulb-outline"
            title="AI Advisor"
            subtitle="Smart tuning"
            onPress={() => router.push("/advisor")}
            accent
          />
          <ActionCard
            testID="action-parse-sms"
            icon="chatbox-ellipses-outline"
            title="Parse SMS"
            subtitle="From bank text"
            onPress={() => router.push("/parse-sms")}
          />
          <ActionCard
            testID="action-history"
            icon="stats-chart-outline"
            title="History"
            subtitle="Monthly & all-time"
            onPress={() => router.push("/(tabs)/history")}
          />
        </View>
      </ScrollView>

      {/* FAB */}
      <Pressable
        testID="spoilance-logger-fab"
        onPress={() => router.push("/spoilance-logger")}
        style={[styles.fab, { bottom: insets.bottom + 84 }]}
      >
        <LinearGradient colors={[colors.brand, colors.brandPrimary]} style={styles.fabInner}>
          <Ionicons name="add" size={26} color={colors.onBrandPrimary} />
          <AppText variant="label" style={{ color: colors.onBrandPrimary }}>Log spoilance</AppText>
        </LinearGradient>
      </Pressable>

      <EditBalancesModal
        visible={editOpen}
        profile={profile}
        onClose={() => setEditOpen(false)}
        onSaved={async () => {
          setEditOpen(false);
          await load();
          toast.show("Balances updated", "success");
        }}
      />
    </ScreenBackground>
  );
}

function ActionCard({
  icon,
  title,
  subtitle,
  onPress,
  accent,
  testID,
}: {
  icon: any;
  title: string;
  subtitle: string;
  onPress: () => void;
  accent?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.actionCard, pressed && { transform: [{ scale: 0.97 }] }]}
    >
      <View style={[styles.actionIcon, accent && { backgroundColor: colors.brandTertiary }]}>
        <Ionicons name={icon} size={22} color={accent ? colors.brand : colors.onSurface} />
      </View>
      <AppText variant="label" style={{ marginTop: spacing.md }}>{title}</AppText>
      <AppText variant="caption" style={{ marginTop: 2 }}>{subtitle}</AppText>
    </Pressable>
  );
}

function EditBalancesModal({
  visible,
  profile,
  onClose,
  onSaved,
}: {
  visible: boolean;
  profile: Profile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [savings, setSavings] = useState(String(Math.round(profile.savings)));
  const [spoilance, setSpoilance] = useState(String(Math.round(profile.spoilance)));
  const [moveAmt, setMoveAmt] = useState("");

  React.useEffect(() => {
    if (visible) {
      setSavings(String(Math.round(profile.savings)));
      setSpoilance(String(Math.round(profile.spoilance)));
      setMoveAmt("");
    }
  }, [visible]);

  async function save() {
    await setBalances(parseFloat(savings) || 0, parseFloat(spoilance) || 0);
    onSaved();
  }

  async function move() {
    const amt = parseFloat(moveAmt) || 0;
    if (amt <= 0) return toast.show("Enter an amount to move.", "error");
    if (amt > profile.spoilance) return toast.show("Not enough spoilance.", "error");
    await moveSpoilanceToSavings(amt);
    onSaved();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.modalHeader}>
            <AppText variant="heading">Adjust balances</AppText>
            <Pressable testID="edit-balances-close" onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={26} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>
          <KeyboardAwareScrollView bottomOffset={20} showsVerticalScrollIndicator={false}>
            <LabeledInput
              testID="edit-savings-input"
              label="Savings"
              value={savings}
              onChangeText={(t) => setSavings(t.replace(/[^0-9.]/g, ""))}
              prefix="₹"
              keyboardType="numeric"
            />
            <LabeledInput
              testID="edit-spoilance-input"
              label="Spoilance"
              value={spoilance}
              onChangeText={(t) => setSpoilance(t.replace(/[^0-9.]/g, ""))}
              prefix="₹"
              keyboardType="numeric"
            />
            <PrimaryButton testID="save-balances-button" label="Save balances" onPress={save} />

            <View style={styles.moveDivider} />
            <AppText variant="label" style={{ marginBottom: spacing.md }}>Move spoilance → savings</AppText>
            <LabeledInput
              testID="move-amount-input"
              label="Amount to move"
              value={moveAmt}
              onChangeText={(t) => setMoveAmt(t.replace(/[^0-9.]/g, ""))}
              prefix="₹"
              keyboardType="numeric"
            />
            <GhostButton testID="move-to-savings-button" label="Move to savings" onPress={move} />
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  kicker: { textTransform: "uppercase", letterSpacing: 2, color: colors.onSurfaceSecondary },
  hello: { marginTop: 2, fontSize: fontSize["3xl"] },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  heroWrap: { paddingHorizontal: spacing.xl, marginTop: spacing.xl },
  heroCard: {
    height: 200,
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroContent: { flex: 1, padding: spacing.xl, justifyContent: "space-between" },
  heroRow: { flexDirection: "row", alignItems: "flex-start" },
  heroBlock: { flex: 1 },
  heroDivider: { width: 1, backgroundColor: colors.borderStrong, marginHorizontal: spacing.lg, alignSelf: "stretch" },
  heroLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroLabel: { textTransform: "uppercase", letterSpacing: 1, color: colors.onSurfaceSecondary },
  savingsValue: { fontFamily: fonts.displayBlack, fontSize: 30, color: colors.success, marginTop: spacing.sm },
  spoilanceValue: { fontFamily: fonts.displayBlack, fontSize: 30, color: colors.brand, marginTop: spacing.sm },
  editBalances: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  todayCard: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: { paddingHorizontal: spacing.xl, marginTop: spacing["2xl"], marginBottom: spacing.md },
  grid: {
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  actionCard: {
    width: "47.7%",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    position: "absolute",
    right: spacing.xl,
    borderRadius: radius.pill,
    overflow: "hidden",
    shadowColor: colors.brandPrimary,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    height: 54,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    maxHeight: "88%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  moveDivider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.xl },
});
