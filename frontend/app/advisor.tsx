import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";

import { AppText, ScreenBackground, GlassCard, PrimaryButton } from "@/src/components/ui";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { formatMoney } from "@/src/utils/money";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/store/AuthContext";
import {
  getProfile,
  getTemplates,
  getEntries,
  getSnapshots,
  getAdvisorResult,
  saveAdvisorResult,
} from "@/src/store/finance";
import { useToast } from "@/src/components/Toast";

const BG = "https://images.pexels.com/photos/19889193/pexels-photo-19889193.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

const HEALTH: Record<string, { label: string; color: string }> = {
  great: { label: "Great", color: colors.success },
  good: { label: "Good", color: colors.success },
  watch: { label: "Watch", color: colors.warning },
  risk: { label: "At risk", color: colors.error },
};

export default function Advisor() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  useEffect(() => {
    (async () => setResult(await getAdvisorResult()))();
  }, []);

  async function analyze() {
    if (user?.guest) {
      toast.show("Sign in with Google to use the AI Advisor.", "error");
      return;
    }
    setLoading(true);
    try {
      const [profile, templates, entries, snaps] = await Promise.all([
        getProfile(),
        getTemplates(),
        getEntries(),
        getSnapshots(),
      ]);
      if (!profile) return;

      const payload = {
        stipend: profile.stipend,
        savings: profile.savings,
        spoilance_limit: profile.spoilanceLimit,
        currency: profile.currency,
        templates: templates.map((t) => ({
          title: t.title,
          amount: t.amount,
          description: t.description,
          weekday: t.weekday,
        })),
        recent_entries: entries.slice(-40).map((e) => ({
          title: e.title,
          limit: e.limit,
          spent: e.amount,
          weekday: e.weekday,
        })),
        spoilance_history: snaps.map((s) => ({
          month: s.monthKey,
          limit: s.spoilanceLimit,
          spent: s.spoilanceSpent,
        })),
      };

      const res = await api.analyzeAdvisor(payload);
      setResult(res);
      await saveAdvisorResult(res);
      toast.show("Analysis ready", "success");
    } catch (e: any) {
      if (e?.status === 401) {
        toast.show("Please sign in with Google to use the AI Advisor.", "error");
      } else {
        toast.show("Advisor couldn't run. Try again.", "error");
      }
    } finally {
      setLoading(false);
    }
  }

  const health = result ? HEALTH[result.overall_health] || HEALTH.good : null;

  return (
    <ScreenBackground>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + spacing["3xl"] }}>
        {/* Hero */}
        <View style={styles.hero}>
          <Image source={{ uri: BG }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={["rgba(11,11,14,0.3)", "rgba(11,11,14,0.95)"]} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroContent, { paddingTop: insets.top + spacing.md }]}>
            <Pressable testID="advisor-back" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
            </Pressable>
            <View style={{ flex: 1, justifyContent: "flex-end" }}>
              <AppText variant="caption" style={styles.kicker}>Powered by Gemini</AppText>
              <AppText variant="title" style={{ fontSize: fontSize["4xl"] }}>AI Advisor</AppText>
              <AppText variant="bodyMuted" style={{ marginTop: spacing.sm, maxWidth: 320 }}>
                A fresh read of your limits, spends and spoilance — with concrete tuning suggestions.
              </AppText>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
          <PrimaryButton
            testID="advisor-analyze-button"
            label={result ? "Re-analyze my finances" : "Analyze my finances"}
            onPress={analyze}
            loading={loading}
            icon={!loading ? <Ionicons name="sparkles" size={18} color={colors.onBrandPrimary} /> : undefined}
          />
          <AppText variant="caption" style={styles.privacy}>
            Your data is sent securely for this analysis only — never stored on our servers.
          </AppText>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={colors.brand} />
              <AppText variant="bodyMuted" style={{ marginTop: spacing.md }}>Reading your spending patterns…</AppText>
            </View>
          ) : null}

          {result && !loading ? (
            <Animated.View entering={FadeInUp.springify().damping(18)}>
              {/* Summary + health */}
              <GlassCard style={{ marginTop: spacing.xl, gap: spacing.md }}>
                {health ? (
                  <View style={[styles.healthBadge, { borderColor: health.color }]}>
                    <View style={[styles.healthDot, { backgroundColor: health.color }]} />
                    <AppText variant="caption" style={{ color: health.color, fontFamily: fonts.bold }}>
                      {health.label}
                    </AppText>
                  </View>
                ) : null}
                <AppText variant="body" style={{ lineHeight: 22 }}>{result.summary}</AppText>
              </GlassCard>

              {/* Limit suggestions */}
              {Array.isArray(result.limit_suggestions) && result.limit_suggestions.length > 0 ? (
                <>
                  <AppText variant="heading" style={styles.section}>Limit suggestions</AppText>
                  {result.limit_suggestions.map((s: any, i: number) => {
                    const down = s.suggested < s.current;
                    return (
                      <GlassCard key={i} style={{ marginBottom: spacing.md, gap: spacing.sm }}>
                        <View style={styles.suggestHeader}>
                          <AppText variant="label">{s.title}</AppText>
                          <View style={styles.changeRow}>
                            <AppText variant="mono" style={{ color: colors.onSurfaceTertiary, fontSize: fontSize.base }}>
                              {formatMoney(s.current)}
                            </AppText>
                            <Ionicons name="arrow-forward" size={14} color={colors.onSurfaceTertiary} />
                            <AppText variant="mono" style={{ color: down ? colors.success : colors.warning, fontSize: fontSize.lg }}>
                              {formatMoney(s.suggested)}
                            </AppText>
                          </View>
                        </View>
                        <AppText variant="caption" style={{ lineHeight: 18 }}>{s.reason}</AppText>
                      </GlassCard>
                    );
                  })}
                </>
              ) : null}

              {/* Spoilance suggestion */}
              {result.spoilance_suggestion ? (
                <>
                  <AppText variant="heading" style={styles.section}>Spoilance</AppText>
                  <GlassCard style={{ gap: spacing.sm }}>
                    <View style={styles.suggestHeader}>
                      <AppText variant="label">Suggested budget</AppText>
                      <View style={styles.changeRow}>
                        <AppText variant="mono" style={{ color: colors.onSurfaceTertiary, fontSize: fontSize.base }}>
                          {formatMoney(result.spoilance_suggestion.current)}
                        </AppText>
                        <Ionicons name="arrow-forward" size={14} color={colors.onSurfaceTertiary} />
                        <AppText variant="mono" style={{ color: colors.brand, fontSize: fontSize.lg }}>
                          {formatMoney(result.spoilance_suggestion.suggested)}
                        </AppText>
                      </View>
                    </View>
                    {result.spoilance_suggestion.move_to_savings ? (
                      <AppText variant="caption" style={{ color: colors.success }}>
                        Move {formatMoney(result.spoilance_suggestion.move_to_savings)} to savings
                      </AppText>
                    ) : null}
                    <AppText variant="caption" style={{ lineHeight: 18 }}>{result.spoilance_suggestion.reason}</AppText>
                  </GlassCard>
                </>
              ) : null}

              {/* Tips */}
              {Array.isArray(result.tips) && result.tips.length > 0 ? (
                <>
                  <AppText variant="heading" style={styles.section}>Tips</AppText>
                  {result.tips.map((t: string, i: number) => (
                    <View key={i} style={styles.tipRow}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.brand} style={{ marginTop: 2 }} />
                      <AppText variant="body" style={{ flex: 1, lineHeight: 20 }}>{t}</AppText>
                    </View>
                  ))}
                </>
              ) : null}
            </Animated.View>
          ) : null}

          {!result && !loading ? (
            <View style={styles.emptyHint}>
              <Ionicons name="bulb-outline" size={28} color={colors.onSurfaceTertiary} />
              <AppText variant="bodyMuted" style={{ marginTop: spacing.md, textAlign: "center", lineHeight: 20 }}>
                Log a few days of spending, then let the advisor find where you can save more or splurge smarter.
              </AppText>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  hero: { height: 280, overflow: "hidden" },
  heroContent: { flex: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  kicker: { textTransform: "uppercase", letterSpacing: 3, color: colors.brand, fontFamily: fonts.semibold },
  privacy: { textAlign: "center", marginTop: spacing.md, color: colors.onSurfaceTertiary, lineHeight: 16 },
  loadingCard: { alignItems: "center", padding: spacing["2xl"] },
  section: { marginTop: spacing["2xl"], marginBottom: spacing.md },
  healthBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  healthDot: { width: 8, height: 8, borderRadius: 4 },
  suggestHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  changeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  tipRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md, alignItems: "flex-start" },
  emptyHint: { alignItems: "center", padding: spacing["2xl"], marginTop: spacing.lg },
});
