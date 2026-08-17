import React, { useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { useAuth } from "@/src/store/AuthContext";
import {
  getProfile,
  getPendingFields,
  performMonthlyResetIfNeeded,
} from "@/src/store/finance";
import { colors, fonts, fontSize } from "@/src/theme";
import { AppText } from "@/src/components/ui";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [msg, setMsg] = useState("Loading");

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      if (!user) {
        router.replace("/login");
        return;
      }
      await performMonthlyResetIfNeeded();
      const profile = await getProfile();
      if (cancelled) return;
      if (!profile || !profile.onboarded) {
        router.replace("/onboarding");
        return;
      }
      const pending = await getPendingFields();
      if (cancelled) return;
      if (pending.length > 0) {
        router.replace("/gate");
      } else {
        router.replace("/(tabs)/home");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return (
    <LinearGradient colors={["#0B0B0E", "#14110B", "#0B0B0E"]} style={styles.container}>
      <View style={styles.center}>
        <AppText variant="display" style={styles.logo}>
          Spoilancer
        </AppText>
        <AppText variant="caption" style={styles.tag}>
          Spend with intention.
        </AppText>
        <ActivityIndicator color={colors.brand} style={{ marginTop: 28 }} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: { fontSize: fontSize["5xl"], color: colors.brand, letterSpacing: -1 },
  tag: { marginTop: 8, letterSpacing: 2, textTransform: "uppercase", fontFamily: fonts.medium },
});
