import React from "react";
import {
  Text,
  TextProps,
  Pressable,
  PressableProps,
  StyleSheet,
  View,
  ViewStyle,
  ActivityIndicator,
  StyleProp,
  TextStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";

// ---------------- Text ----------------
type Variant =
  | "display"
  | "displaySemi"
  | "title"
  | "heading"
  | "body"
  | "bodyMuted"
  | "label"
  | "caption"
  | "mono";

const textStyles: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.displayBlack, fontSize: fontSize["4xl"], color: colors.onSurface },
  displaySemi: { fontFamily: fonts.displaySemi, fontSize: fontSize["2xl"], color: colors.onSurface },
  title: { fontFamily: fonts.display, fontSize: fontSize["3xl"], color: colors.onSurface },
  heading: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.onSurface },
  body: { fontFamily: fonts.medium, fontSize: fontSize.lg, color: colors.onSurface },
  bodyMuted: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
  label: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurface },
  caption: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.onSurfaceTertiary },
  mono: { fontFamily: fonts.displaySemi, fontSize: fontSize.xl, color: colors.onSurface },
};

export function AppText({
  variant = "body",
  style,
  ...rest
}: TextProps & { variant?: Variant }) {
  return <Text {...rest} style={[textStyles[variant], style]} />;
}

// ---------------- Screen background ----------------
export function ScreenBackground({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient
      colors={["#0B0B0E", "#101015", "#0B0B0E"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </LinearGradient>
  );
}

// ---------------- Glass card ----------------
export function GlassCard({
  children,
  style,
  intensity = 40,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
}) {
  if (Platform.OS === "android") {
    // Blur is expensive/unreliable on Android — use tinted solid surface.
    return <View style={[styles.cardSolid, style]}>{children}</View>;
  }
  return (
    <BlurView intensity={intensity} tint="dark" style={[styles.cardGlass, style]}>
      <View style={styles.cardTint}>{children}</View>
    </BlurView>
  );
}

// ---------------- Buttons ----------------
export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  style,
  icon,
  testID,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
  testID?: string;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      disabled={inactive}
      onPress={() => {
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [
        styles.primaryBtn,
        inactive && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onBrandPrimary} />
      ) : (
        <View style={styles.btnRow}>
          {icon}
          <Text style={styles.primaryBtnText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  style,
  icon,
  testID,
}: {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (Platform.OS !== "web") Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.7 }, style]}
    >
      <View style={styles.btnRow}>
        {icon}
        <Text style={styles.ghostBtnText}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function Pill({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.pill, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  cardGlass: {
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTint: {
    backgroundColor: "rgba(22,22,26,0.35)",
    padding: spacing.lg,
  },
  cardSolid: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  primaryBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  primaryBtnText: {
    fontFamily: fonts.bold,
    fontSize: fontSize.lg,
    color: colors.onBrandPrimary,
  },
  ghostBtn: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.xl,
  },
  ghostBtnText: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.lg,
    color: colors.onSurface,
  },
  btnRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pill: {
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
});
