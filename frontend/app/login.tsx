import React, { useState } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/store/AuthContext";
import { AppText, PrimaryButton } from "@/src/components/ui";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { useToast } from "@/src/components/Toast";

export default function Login() {
  const { signInWithGoogle, continueOffline } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  async function handleGoogle() {
    try {
      setBusy(true);
      await signInWithGoogle();
    } catch (e) {
      toast.show("Sign in failed. Try again.", "error");
    } finally {
      setBusy(false);
      router.replace("/");
    }
  }

  async function handleOffline() {
    await continueOffline();
    router.replace("/");
  }

  return (
    <LinearGradient colors={["#0B0B0E", "#141009", "#0B0B0E"]} style={styles.container}>
      <Image
        source={{
          uri: "https://images.unsplash.com/photo-1710438399422-2fca27686bcd?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <LinearGradient
        colors={["rgba(11,11,14,0.55)", "rgba(11,11,14,0.85)", "#0B0B0E"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.top}>
          <AppText variant="caption" style={styles.kicker}>
            Smart Daily Finances
          </AppText>
          <AppText variant="display" style={styles.logo}>
            Spoilancer
          </AppText>
          <AppText variant="bodyMuted" style={styles.subtitle}>
            Set a limit on every routine spend. Turn what's left into savings — or spoilance to splurge, guilt-free.
          </AppText>
        </View>

        <View style={styles.bottom}>
          <PrimaryButton
            testID="google-signin-button"
            label={busy ? "Opening…" : "Continue with Google"}
            loading={busy}
            onPress={handleGoogle}
            icon={<Ionicons name="logo-google" size={20} color={colors.onBrandPrimary} />}
          />
          <Pressable testID="continue-offline-button" onPress={handleOffline} style={styles.offlineBtn}>
            <Ionicons name="phone-portrait-outline" size={18} color={colors.onSurfaceSecondary} />
            <AppText variant="label" style={{ color: colors.onSurfaceSecondary }}>
              Continue offline (local only)
            </AppText>
          </Pressable>
          <AppText variant="caption" style={styles.privacy}>
            Your money data always stays on this device.
          </AppText>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: "space-between" },
  top: {},
  kicker: {
    letterSpacing: 3,
    textTransform: "uppercase",
    color: colors.brand,
    fontFamily: fonts.semibold,
  },
  logo: { fontSize: 52, color: colors.onSurface, marginTop: spacing.sm, letterSpacing: -1 },
  subtitle: { marginTop: spacing.lg, lineHeight: 22, maxWidth: 340, fontSize: fontSize.lg },
  bottom: { gap: spacing.lg },
  offlineBtn: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    height: 48,
  },
  privacy: { textAlign: "center", color: colors.onSurfaceTertiary },
});
