import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, Modal } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { AppText, ScreenBackground, GlassCard, PrimaryButton, GhostButton } from "@/src/components/ui";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { useAuth } from "@/src/store/AuthContext";
import { getProfile, Profile, wipeAllData } from "@/src/store/finance";
import { storage } from "@/src/utils/storage";
import { useToast } from "@/src/components/Toast";
import { ensureNotificationPermission, rescheduleReminders } from "@/src/utils/notifications";

const LANGUAGES = ["English", "हिन्दी (Hindi)", "Español", "Français", "Deutsch"];
const LANG_KEY = "spoilancer.language";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [language, setLanguage] = useState("English");
  const [langOpen, setLangOpen] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const load = useCallback(async () => {
    setProfile(await getProfile());
    const lang = await storage.getItem<string>(LANG_KEY, "English");
    if (lang && typeof lang === "string") setLanguage(lang);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function pickLanguage(l: string) {
    setLanguage(l);
    await storage.setItem(LANG_KEY, l);
    setLangOpen(false);
    toast.show(`Language set to ${l}`, "success");
  }

  async function enableReminders() {
    const granted = await ensureNotificationPermission();
    if (granted) {
      await rescheduleReminders();
      toast.show("Reminders scheduled", "success");
    } else {
      toast.show("Enable notifications in Settings to get reminders", "error");
    }
  }

  async function doWipe() {
    await wipeAllData();
    setConfirmWipe(false);
    await signOut();
    router.replace("/");
  }

  const name = profile?.name || user?.name || "You";
  const email = user?.email || (user?.guest ? "Offline account" : "");

  return (
    <ScreenBackground>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 140, paddingHorizontal: spacing.xl }}>
        <AppText variant="title" style={styles.title}>Profile</AppText>

        <GlassCard style={styles.profileCard}>
          <View style={styles.avatar}>
            <AppText variant="display" style={{ color: colors.onBrandPrimary, fontSize: 28 }}>
              {name.charAt(0).toUpperCase()}
            </AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="heading">{name}</AppText>
            <AppText variant="caption" style={{ marginTop: 2 }}>{email || "Local device account"}</AppText>
          </View>
        </GlassCard>

        {profile ? (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <AppText variant="caption" style={styles.statLabel}>Stipend</AppText>
              <AppText variant="label" style={{ marginTop: 4 }}>₹{Math.round(profile.stipend).toLocaleString("en-IN")}</AppText>
            </View>
            <View style={styles.statBox}>
              <AppText variant="caption" style={styles.statLabel}>Since</AppText>
              <AppText variant="label" style={{ marginTop: 4 }}>
                {new Date(profile.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
              </AppText>
            </View>
          </View>
        ) : null}

        <AppText variant="heading" style={styles.section}>Settings</AppText>
        <View style={styles.settingsGroup}>
          <SettingRow icon="language-outline" label="Language" value={language} onPress={() => setLangOpen(true)} testID="setting-language" />
          <Divider />
          <SettingRow icon="notifications-outline" label="Daily reminders" value="Manage" onPress={enableReminders} testID="setting-reminders" />
          <Divider />
          <SettingRow icon="create-outline" label="Edit daily limits" onPress={() => router.push("/limits")} testID="setting-limits" />
          <Divider />
          <SettingRow icon="settings-outline" label="App settings" onPress={() => router.push("/settings")} testID="setting-app" />
        </View>

        <AppText variant="heading" style={styles.section}>Account</AppText>
        <View style={styles.settingsGroup}>
          <SettingRow icon="log-out-outline" label="Sign out" onPress={async () => { await signOut(); router.replace("/"); }} testID="setting-signout" />
          <Divider />
          <SettingRow icon="trash-outline" label="Reset all data" danger onPress={() => setConfirmWipe(true)} testID="setting-wipe" />
        </View>

        <AppText variant="caption" style={styles.footer}>
          Spoilancer · v1.0 · Your financial data lives only on this device.
        </AppText>
      </ScrollView>

      {/* Language modal */}
      <Modal visible={langOpen} transparent animationType="slide" onRequestClose={() => setLangOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHeader}>
              <AppText variant="heading">Language</AppText>
              <Pressable onPress={() => setLangOpen(false)} hitSlop={12} testID="lang-close">
                <Ionicons name="close" size={26} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>
            {LANGUAGES.map((l) => (
              <Pressable key={l} testID={`lang-${l}`} onPress={() => pickLanguage(l)} style={styles.langRow}>
                <AppText variant="body">{l}</AppText>
                {language === l ? <Ionicons name="checkmark" size={20} color={colors.brand} /> : null}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* Wipe confirm */}
      <Modal visible={confirmWipe} transparent animationType="fade" onRequestClose={() => setConfirmWipe(false)}>
        <View style={styles.centerOverlay}>
          <View style={styles.confirmCard}>
            <Ionicons name="warning" size={30} color={colors.error} />
            <AppText variant="heading" style={{ marginTop: spacing.md }}>Reset everything?</AppText>
            <AppText variant="bodyMuted" style={{ textAlign: "center", marginTop: spacing.sm, lineHeight: 20 }}>
              This permanently deletes your budget, limits and history from this device. This can't be undone.
            </AppText>
            <View style={{ height: spacing.xl }} />
            <PrimaryButton testID="confirm-wipe-button" label="Delete everything" onPress={doWipe} style={{ backgroundColor: colors.error, width: "100%" }} />
            <GhostButton label="Cancel" onPress={() => setConfirmWipe(false)} style={{ marginTop: spacing.md, width: "100%" }} />
          </View>
        </View>
      </Modal>
    </ScreenBackground>
  );
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
  danger,
  testID,
}: {
  icon: any;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
  testID?: string;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.settingRow, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={22} color={danger ? colors.error : colors.brand} />
      <AppText variant="body" style={{ flex: 1, marginLeft: spacing.md, color: danger ? colors.error : colors.onSurface }}>
        {label}
      </AppText>
      {value ? <AppText variant="caption" style={{ marginRight: spacing.sm }}>{value}</AppText> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
    </Pressable>
  );
}

const Divider = () => <View style={styles.rowDivider} />;

const styles = StyleSheet.create({
  title: { fontSize: fontSize["4xl"] },
  profileCard: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.lg },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  statBox: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  statLabel: { textTransform: "uppercase", letterSpacing: 1 },
  section: { marginTop: spacing["2xl"], marginBottom: spacing.md },
  settingsGroup: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  settingRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, height: 56 },
  rowDivider: { height: 1, backgroundColor: colors.divider, marginLeft: 52 },
  footer: { textAlign: "center", marginTop: spacing["2xl"], lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, borderWidth: 1, borderColor: colors.border },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  langRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: 52 },
  centerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  confirmCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: "center", width: "100%", maxWidth: 380 },
});
