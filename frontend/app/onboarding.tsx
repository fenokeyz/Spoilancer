import React, { useMemo, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";

import { AppText, PrimaryButton, ScreenBackground, GlassCard, Pill } from "@/src/components/ui";
import { LabeledInput, FieldEditorModal, formatTime } from "@/src/components/fields";
import { ProgressBar } from "@/src/components/ProgressBar";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { formatMoney } from "@/src/utils/money";
import {
  WEEKDAYS,
  weekdayOccurrencesThisMonth,
  monthKeyOf,
  saveTemplates,
  saveProfile,
  ExpenseField,
} from "@/src/store/finance";
import { useAuth } from "@/src/store/AuthContext";
import { useToast } from "@/src/components/Toast";
import { ensureNotificationPermission, rescheduleReminders } from "@/src/utils/notifications";

interface DraftField {
  id: string;
  title: string;
  amount: number;
  description: string;
  hour: number;
  minute: number;
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState(0); // 0 stipend, 1..7 days, 8 summary
  const [stipend, setStipend] = useState("");
  const [days, setDays] = useState<DraftField[][]>([[], [], [], [], [], [], []]);
  const [spoilanceAlloc, setSpoilanceAlloc] = useState("");
  const [editor, setEditor] = useState<{ open: boolean; day: number; index: number | null }>({
    open: false,
    day: 0,
    index: null,
  });

  const occ = useMemo(() => weekdayOccurrencesThisMonth(), []);
  const stipendNum = parseFloat(stipend) || 0;

  const monthlyCommitted = useMemo(() => {
    return days.reduce((sum, dayFields, idx) => {
      const dayTotal = dayFields.reduce((s, f) => s + f.amount, 0);
      return sum + dayTotal * occ[idx];
    }, 0);
  }, [days, occ]);

  const projectedSavings = Math.max(0, stipendNum - monthlyCommitted);
  const overBudget = monthlyCommitted > stipendNum && stipendNum > 0;

  const totalSteps = 9;
  const dayIndex = step - 1; // valid when 1..7

  function openEditor(day: number, index: number | null) {
    setEditor({ open: true, day, index });
  }

  function saveField(data: { title: string; amount: number; description: string; hour: number; minute: number }) {
    setDays((prev) => {
      const next = prev.map((d) => [...d]);
      if (editor.index === null) {
        next[editor.day].push({ id: uid(), ...data });
      } else {
        next[editor.day][editor.index] = { ...next[editor.day][editor.index], ...data };
      }
      next[editor.day].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
      return next;
    });
    setEditor({ open: false, day: 0, index: null });
  }

  function deleteField() {
    if (editor.index === null) return;
    setDays((prev) => {
      const next = prev.map((d) => [...d]);
      next[editor.day].splice(editor.index!, 1);
      return next;
    });
    setEditor({ open: false, day: 0, index: null });
  }

  function copyPreviousDay() {
    if (dayIndex <= 0) return;
    const prevDay = days[dayIndex - 1];
    setDays((prev) => {
      const next = prev.map((d) => [...d]);
      next[dayIndex] = prevDay.map((f) => ({ ...f, id: uid() }));
      return next;
    });
    toast.show(`Copied ${WEEKDAYS[dayIndex - 1]}'s setup`, "success");
  }

  function next() {
    if (step === 0) {
      if (stipendNum <= 0) return toast.show("Enter your monthly stipend.", "error");
    }
    if (step === 7 && overBudget) {
      return toast.show("Your limits exceed your stipend. Reduce some.", "error");
    }
    setStep((s) => Math.min(totalSteps - 1, s + 1));
  }

  function back() {
    if (step === 0) {
      router.back();
      return;
    }
    setStep((s) => s - 1);
  }

  async function finish() {
    const alloc = Math.min(parseFloat(spoilanceAlloc) || 0, projectedSavings);
    const templates: ExpenseField[] = [];
    days.forEach((dayFields, weekday) => {
      dayFields.forEach((f) => {
        templates.push({
          id: f.id,
          weekday,
          title: f.title,
          amount: f.amount,
          description: f.description,
          hour: f.hour,
          minute: f.minute,
        });
      });
    });
    await saveTemplates(templates);
    await saveProfile({
      name: user?.name || "You",
      email: user?.email || "",
      currency: "INR",
      stipend: stipendNum,
      balance: Math.round((stipendNum - alloc) * 100) / 100,
      spoilance: alloc,
      spoilanceLimit: alloc,
      leftoverTarget: "spoilance",
      onboarded: true,
      monthKey: monthKeyOf(),
      createdAt: new Date().toISOString(),
    });

    const granted = await ensureNotificationPermission();
    if (granted) await rescheduleReminders();

    router.replace("/");
  }

  const editorInitial =
    editor.open && editor.index !== null
      ? {
          title: days[editor.day][editor.index!].title,
          amount: String(days[editor.day][editor.index!].amount),
          description: days[editor.day][editor.index!].description,
          hour: String(days[editor.day][editor.index!].hour),
          minute: String(days[editor.day][editor.index!].minute),
        }
      : null;

  return (
    <ScreenBackground>
      <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
        {/* Header + progress */}
        <View style={styles.header}>
          <Pressable testID="onboarding-back" onPress={back} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <ProgressBar progress={(step + 1) / totalSteps} />
          </View>
          <AppText variant="caption" style={{ marginLeft: spacing.md }}>
            {step + 1}/{totalSteps}
          </AppText>
        </View>

        {step === 0 && (
          <StipendStep stipend={stipend} setStipend={setStipend} />
        )}

        {step >= 1 && step <= 7 && (
          <DayStep
            dayIndex={dayIndex}
            fields={days[dayIndex]}
            onAdd={() => openEditor(dayIndex, null)}
            onEdit={(i) => openEditor(dayIndex, i)}
            onCopyPrev={dayIndex > 0 ? copyPreviousDay : undefined}
            prevDayName={dayIndex > 0 ? WEEKDAYS[dayIndex - 1] : ""}
            dayTotal={days[dayIndex].reduce((s, f) => s + f.amount, 0)}
          />
        )}

        {step === 8 && (
          <SummaryStep
            stipend={stipendNum}
            committed={monthlyCommitted}
            projectedSavings={projectedSavings}
            spoilanceAlloc={spoilanceAlloc}
            setSpoilanceAlloc={setSpoilanceAlloc}
          />
        )}

        {/* Footer CTA */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          {overBudget && step >= 1 && step <= 7 ? (
            <AppText variant="caption" style={styles.warn}>
              ⚠ Monthly limits ({formatMoney(monthlyCommitted)}) exceed stipend.
            </AppText>
          ) : null}
          {step < 8 ? (
            <PrimaryButton testID="onboarding-continue" label="Continue" onPress={next} />
          ) : (
            <PrimaryButton testID="onboarding-finish" label="Set me up" onPress={finish} />
          )}
        </View>
      </View>

      <FieldEditorModal
        visible={editor.open}
        initial={editorInitial}
        onSave={saveField}
        onClose={() => setEditor({ open: false, day: 0, index: null })}
        onDelete={editor.index !== null ? deleteField : undefined}
      />
    </ScreenBackground>
  );
}

function StipendStep({ stipend, setStipend }: { stipend: string; setStipend: (t: string) => void }) {
  return (
    <KeyboardAwareScrollView bottomOffset={20} showsVerticalScrollIndicator={false} contentContainerStyle={styles.stepPad}>
      <AppText variant="caption" style={styles.kicker}>Step one</AppText>
      <AppText variant="title" style={styles.stepTitle}>What's your monthly stipend?</AppText>
      <AppText variant="bodyMuted" style={styles.stepSub}>
        This is the total money you have to work with each month. Everything flows from here.
      </AppText>
      <View style={{ marginTop: spacing["2xl"] }}>
        <LabeledInput
          testID="stipend-input"
          label="Monthly stipend"
          value={stipend}
          onChangeText={setStipend}
          placeholder="0"
          prefix="₹"
          keyboardType="numeric"
          money
          autoFocus
        />
      </View>
    </KeyboardAwareScrollView>
  );
}

function DayStep({
  dayIndex,
  fields,
  onAdd,
  onEdit,
  onCopyPrev,
  prevDayName,
  dayTotal,
}: {
  dayIndex: number;
  fields: DraftField[];
  onAdd: () => void;
  onEdit: (i: number) => void;
  onCopyPrev?: () => void;
  prevDayName: string;
  dayTotal: number;
}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stepPad}>
      <AppText variant="caption" style={styles.kicker}>Daily limits</AppText>
      <AppText variant="title" style={styles.stepTitle}>{WEEKDAYS[dayIndex]}</AppText>
      <View style={styles.dayMetaRow}>
        <AppText variant="bodyMuted">
          {fields.length} {fields.length === 1 ? "expense" : "expenses"}
        </AppText>
        <Pill>
          <AppText variant="caption" style={{ color: colors.brand, fontFamily: fonts.bold }}>
            Day total {formatMoney(dayTotal)}
          </AppText>
        </Pill>
      </View>

      {onCopyPrev ? (
        <Pressable testID="copy-previous-day" onPress={onCopyPrev} style={styles.copyBtn}>
          <Ionicons name="copy-outline" size={18} color={colors.brand} />
          <AppText variant="label" style={{ color: colors.brand }}>
            Same as {prevDayName}
          </AppText>
        </Pressable>
      ) : null}

      {fields.map((f, i) => (
        <Pressable key={f.id} testID={`day-field-${i}`} onPress={() => onEdit(i)}>
          <GlassCard style={styles.fieldCard}>
            <View style={{ flex: 1 }}>
              <AppText variant="heading">{f.title}</AppText>
              <AppText variant="caption" style={{ marginTop: 2 }}>
                {formatTime(f.hour, f.minute)}
                {f.description ? ` · ${f.description}` : ""}
              </AppText>
            </View>
            <AppText variant="mono" style={{ color: colors.brand }}>{formatMoney(f.amount)}</AppText>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} style={{ marginLeft: 8 }} />
          </GlassCard>
        </Pressable>
      ))}

      {fields.length === 0 ? (
        <AppText variant="bodyMuted" style={styles.emptyDay}>
          No expenses yet for {WEEKDAYS[dayIndex]}. Add the ones you'll routinely spend on.
        </AppText>
      ) : null}

      <Pressable testID="add-field-button" onPress={onAdd} style={styles.addBtn}>
        <Ionicons name="add-circle" size={22} color={colors.brand} />
        <AppText variant="label" style={{ color: colors.brand }}>Add expense</AppText>
      </Pressable>
    </ScrollView>
  );
}

function SummaryStep({
  stipend,
  committed,
  projectedSavings,
  spoilanceAlloc,
  setSpoilanceAlloc,
}: {
  stipend: number;
  committed: number;
  projectedSavings: number;
  spoilanceAlloc: string;
  setSpoilanceAlloc: (t: string) => void;
}) {
  const alloc = Math.min(parseFloat(spoilanceAlloc) || 0, projectedSavings);
  const finalSavings = projectedSavings - alloc;
  const presets = [0, 0.25, 0.5];

  return (
    <KeyboardAwareScrollView bottomOffset={20} showsVerticalScrollIndicator={false} contentContainerStyle={styles.stepPad}>
      <AppText variant="caption" style={styles.kicker}>Almost there</AppText>
      <AppText variant="title" style={styles.stepTitle}>Your monthly picture</AppText>

      <GlassCard style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <Row label="Monthly stipend" value={formatMoney(stipend)} />
        <Row label="Committed to limits" value={`- ${formatMoney(committed)}`} muted />
        <View style={styles.divider} />
        <Row label="Projected savings" value={formatMoney(projectedSavings)} highlight />
      </GlassCard>

      <AppText variant="heading" style={{ marginTop: spacing["2xl"] }}>Set aside some Spoilance</AppText>
      <AppText variant="bodyMuted" style={{ marginTop: spacing.sm, lineHeight: 20 }}>
        Spoilance is your guilt-free splurge budget — for games, gadgets, dates. Take a slice from savings now (leftover from daily limits will top it up too).
      </AppText>

      <View style={styles.presetRow}>
        {presets.map((p) => (
          <Pressable
            key={p}
            testID={`spoilance-preset-${p}`}
            onPress={() => setSpoilanceAlloc(String(Math.round(projectedSavings * p)))}
            style={styles.presetChip}
          >
            <AppText variant="label">{p === 0 ? "None" : `${p * 100}%`}</AppText>
          </Pressable>
        ))}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <LabeledInput
          testID="spoilance-alloc-input"
          label="Spoilance allocation"
          value={spoilanceAlloc}
          onChangeText={setSpoilanceAlloc}
          placeholder="0"
          prefix="₹"
          keyboardType="numeric"
          money
        />
      </View>

      <GlassCard style={{ marginTop: spacing.md, gap: spacing.md }}>
        <Row label="Projected savings" value={formatMoney(finalSavings)} highlight />
        <Row label="Spoilance" value={formatMoney(alloc)} brandValue />
      </GlassCard>
      <AppText variant="caption" style={{ marginTop: spacing.md, lineHeight: 16, color: colors.onSurfaceTertiary }}>
        Projected if you hit every limit. Home shows your live balance as you actually spend.
      </AppText>
    </KeyboardAwareScrollView>
  );
}

function Row({
  label,
  value,
  highlight,
  muted,
  brandValue,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
  brandValue?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <AppText variant={highlight ? "heading" : "body"} style={muted ? { color: colors.onSurfaceSecondary } : undefined}>
        {label}
      </AppText>
      <AppText
        variant="mono"
        style={{
          color: brandValue ? colors.brand : highlight ? colors.success : colors.onSurface,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.xl },
  header: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  stepPad: { paddingBottom: spacing["3xl"] },
  kicker: { textTransform: "uppercase", letterSpacing: 3, color: colors.brand, fontFamily: fonts.semibold },
  stepTitle: { marginTop: spacing.sm, fontSize: fontSize["4xl"] },
  stepSub: { marginTop: spacing.md, lineHeight: 22, fontSize: fontSize.lg },
  dayMetaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    height: 44,
    alignSelf: "flex-start",
  },
  fieldCard: { flexDirection: "row", alignItems: "center", marginTop: spacing.md },
  emptyDay: { marginTop: spacing.xl, lineHeight: 20 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: "dashed",
  },
  footer: { paddingTop: spacing.md },
  warn: { color: colors.warning, textAlign: "center", marginBottom: spacing.sm },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  divider: { height: 1, backgroundColor: colors.divider },
  presetRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  presetChip: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
});
