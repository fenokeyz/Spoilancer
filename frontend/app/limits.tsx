import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, FlatList } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";

import { AppText, ScreenBackground, GlassCard, Pill } from "@/src/components/ui";
import { FieldEditorModal, FieldDraft, formatTime } from "@/src/components/fields";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { formatMoney } from "@/src/utils/money";
import {
  WEEKDAYS,
  WEEKDAYS_SHORT,
  weekdayIndex,
  getTemplatesForDay,
  addTemplate,
  updateTemplate,
  deleteTemplate,
  ExpenseField,
} from "@/src/store/finance";
import { useToast } from "@/src/components/Toast";
import { ensureNotificationPermission, rescheduleReminders } from "@/src/utils/notifications";

const DAY_ICONS: any[] = ["sunny-outline", "cafe-outline", "leaf-outline", "flash-outline", "wine-outline", "game-controller-outline", "bed-outline"];

export default function Limits() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [selectedDay, setSelectedDay] = useState(weekdayIndex());
  const [fields, setFields] = useState<ExpenseField[]>([]);
  const [editor, setEditor] = useState<{ open: boolean; field: ExpenseField | null }>({ open: false, field: null });

  const loadDay = useCallback(async (day: number) => {
    setFields(await getTemplatesForDay(day));
  }, []);

  useFocusEffect(useCallback(() => { loadDay(selectedDay); }, [selectedDay, loadDay]));

  async function afterChange() {
    await loadDay(selectedDay);
    const granted = await ensureNotificationPermission();
    if (granted) await rescheduleReminders();
  }

  async function handleSave(data: { title: string; amount: number; description: string; hour: number; minute: number }) {
    if (editor.field) {
      await updateTemplate({ ...editor.field, ...data });
      toast.show("Expense updated", "success");
    } else {
      await addTemplate({ ...data, weekday: selectedDay });
      toast.show("Expense added", "success");
    }
    setEditor({ open: false, field: null });
    await afterChange();
  }

  async function handleDelete() {
    if (editor.field) {
      await deleteTemplate(editor.field.id);
      toast.show("Expense deleted", "info");
    }
    setEditor({ open: false, field: null });
    await afterChange();
  }

  const dayTotal = fields.reduce((s, f) => s + f.amount, 0);

  const editorInitial: FieldDraft | null = editor.field
    ? {
        title: editor.field.title,
        amount: String(editor.field.amount),
        description: editor.field.description,
        hour: String(editor.field.hour),
        minute: String(editor.field.minute),
      }
    : null;

  return (
    <ScreenBackground>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <Pressable testID="limits-back" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
          </Pressable>
          <AppText variant="heading">Daily Limits</AppText>
          <View style={{ width: 36 }} />
        </View>

        {/* Day chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {WEEKDAYS_SHORT.map((d, i) => {
            const active = i === selectedDay;
            return (
              <Pressable
                key={d}
                testID={`day-chip-${i}`}
                onPress={() => setSelectedDay(i)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Ionicons name={DAY_ICONS[i]} size={16} color={active ? colors.onBrandPrimary : colors.onSurfaceSecondary} />
                <AppText
                  variant="label"
                  style={{ color: active ? colors.onBrandPrimary : colors.onSurfaceSecondary, fontSize: fontSize.base }}
                >
                  {d}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={fields}
        keyExtractor={(f) => f.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: insets.bottom + 120 }}
        ListHeaderComponent={
          <View style={styles.dayMeta}>
            <AppText variant="title" style={{ fontSize: fontSize["3xl"] }}>{WEEKDAYS[selectedDay]}</AppText>
            <Pill>
              <AppText variant="caption" style={{ color: colors.brand, fontFamily: fonts.bold }}>
                Total {formatMoney(dayTotal)}
              </AppText>
            </Pill>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeIn.delay(index * 40)}>
            <Pressable testID={`limit-field-${index}`} onPress={() => setEditor({ open: true, field: item })}>
              <GlassCard style={styles.fieldCard}>
                <View style={{ flex: 1 }}>
                  <AppText variant="heading">{item.title}</AppText>
                  <AppText variant="caption" style={{ marginTop: 2 }}>
                    {formatTime(item.hour, item.minute)}{item.description ? ` · ${item.description}` : ""}
                  </AppText>
                </View>
                <AppText variant="mono" style={{ color: colors.brand }}>{formatMoney(item.amount)}</AppText>
                <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} style={{ marginLeft: 8 }} />
              </GlassCard>
            </Pressable>
          </Animated.View>
        )}
        ListEmptyComponent={
          <AppText variant="bodyMuted" style={{ marginTop: spacing.xl, lineHeight: 20 }}>
            No expenses for {WEEKDAYS[selectedDay]}. Add one below.
          </AppText>
        }
        ListFooterComponent={
          <Pressable testID="limits-add-button" onPress={() => setEditor({ open: true, field: null })} style={styles.addBtn}>
            <Ionicons name="add-circle" size={22} color={colors.brand} />
            <AppText variant="label" style={{ color: colors.brand }}>Add expense</AppText>
          </Pressable>
        }
      />

      <FieldEditorModal
        visible={editor.open}
        initial={editorInitial}
        onSave={handleSave}
        onClose={() => setEditor({ open: false, field: null })}
        onDelete={editor.field ? handleDelete : undefined}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.surface },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  chip: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  dayMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  fieldCard: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: "dashed",
  },
});
