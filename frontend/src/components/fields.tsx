import React, { useEffect, useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Modal,
  Pressable,
  TextInputProps,
  Platform,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, PrimaryButton, GhostButton } from "@/src/components/ui";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";

export function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  prefix,
  multiline,
  testID,
  autoFocus,
  money,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  prefix?: string;
  multiline?: boolean;
  testID?: string;
  autoFocus?: boolean;
  money?: boolean;
} & TextInputProps) {
  const displayValue = money ? groupIndianInput(value) : value;

  function handleChange(t: string) {
    if (!money) return onChangeText(t);
    // strip commas + anything non-numeric, keep a single decimal point
    const raw = t.replace(/,/g, "").replace(/[^0-9.]/g, "");
    const parts = raw.split(".");
    const cleaned = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("")}` : raw;
    onChangeText(cleaned);
  }

  return (
    <View style={styles.inputWrap}>
      <AppText variant="caption" style={styles.inputLabel}>
        {label}
      </AppText>
      <View style={[styles.inputBox, multiline && { height: 92, alignItems: "flex-start" }]}>
        {prefix ? <AppText variant="heading" style={styles.prefix}>{prefix}</AppText> : null}
        <TextInput
          testID={testID}
          value={displayValue}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.onSurfaceTertiary}
          keyboardType={keyboardType}
          multiline={multiline}
          autoFocus={autoFocus}
          style={[styles.input, multiline && { height: 84, textAlignVertical: "top", paddingTop: 4 }]}
          {...rest}
        />
      </View>
    </View>
  );
}

// Formats a raw numeric string with Indian (lakh/crore) comma grouping for display,
// preserving a trailing decimal being typed.
function groupIndianInput(raw: string): string {
  if (!raw) return "";
  const [intPart, decPart] = raw.split(".");
  let grouped = intPart;
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  return decPart !== undefined ? `${grouped}.${decPart}` : grouped;
}

export interface FieldDraft {
  title: string;
  amount: string;
  description: string;
  hour: string;
  minute: string;
}

export function formatTime(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

export function FieldEditorModal({
  visible,
  initial,
  onSave,
  onClose,
  onDelete,
}: {
  visible: boolean;
  initial?: FieldDraft | null;
  onSave: (d: { title: string; amount: number; description: string; hour: number; minute: number }) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<FieldDraft>({
    title: "",
    amount: "",
    description: "",
    hour: "9",
    minute: "0",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setDraft(
        initial ?? { title: "", amount: "", description: "", hour: "9", minute: "0" },
      );
      setError("");
    }
  }, [visible]);

  function handleSave() {
    const title = draft.title.trim();
    const amount = parseFloat(draft.amount);
    const hour = parseInt(draft.hour, 10);
    const minute = parseInt(draft.minute, 10);
    if (!title) return setError("Give this expense a title.");
    if (!amount || amount <= 0) return setError("Enter a valid limit amount.");
    if (isNaN(hour) || hour < 0 || hour > 23) return setError("Hour must be 0–23.");
    if (isNaN(minute) || minute < 0 || minute > 59) return setError("Minute must be 0–59.");
    onSave({ title, amount, description: draft.description.trim(), hour, minute });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.modalHeader}>
            <AppText variant="heading">{initial ? "Edit expense" : "New expense"}</AppText>
            <Pressable testID="field-editor-close" onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={26} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>

          <KeyboardAwareScrollView
            bottomOffset={20}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: spacing.lg }}
          >
            <LabeledInput
              testID="field-title-input"
              label="Title"
              value={draft.title}
              onChangeText={(t) => setDraft((d) => ({ ...d, title: t }))}
              placeholder="e.g. Morning coffee"
              autoFocus
            />
            <LabeledInput
              testID="field-amount-input"
              label="Daily limit"
              value={draft.amount}
              onChangeText={(t) => setDraft((d) => ({ ...d, amount: t }))}
              placeholder="0"
              prefix="₹"
              keyboardType="numeric"
              money
            />
            <LabeledInput
              testID="field-desc-input"
              label="Description / context"
              value={draft.description}
              onChangeText={(t) => setDraft((d) => ({ ...d, description: t }))}
              placeholder="What is this spend for? Helps the AI advisor."
              multiline
            />
            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <LabeledInput
                  testID="field-hour-input"
                  label="Hour (0–23)"
                  value={draft.hour}
                  onChangeText={(t) => setDraft((d) => ({ ...d, hour: t.replace(/[^0-9]/g, "") }))}
                  placeholder="9"
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <LabeledInput
                  testID="field-minute-input"
                  label="Minute (0–59)"
                  value={draft.minute}
                  onChangeText={(t) => setDraft((d) => ({ ...d, minute: t.replace(/[^0-9]/g, "") }))}
                  placeholder="00"
                  keyboardType="numeric"
                />
              </View>
            </View>
            <AppText variant="caption" style={{ color: colors.onSurfaceTertiary }}>
              You'll be asked to log this spend at{" "}
              {formatTime(parseInt(draft.hour || "0", 10) || 0, parseInt(draft.minute || "0", 10) || 0)}.
            </AppText>

            {error ? (
              <AppText variant="caption" style={styles.error} testID="field-editor-error">
                {error}
              </AppText>
            ) : null}
          </KeyboardAwareScrollView>

          <View style={styles.modalActions}>
            {onDelete ? (
              <GhostButton
                testID="field-delete-button"
                label="Delete"
                onPress={onDelete}
                style={{ flex: 1, borderColor: colors.error }}
                icon={<Ionicons name="trash-outline" size={18} color={colors.error} />}
              />
            ) : null}
            <PrimaryButton
              testID="field-save-button"
              label="Save"
              onPress={handleSave}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  inputWrap: { marginBottom: spacing.lg },
  inputLabel: {
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.onSurfaceSecondary,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
  },
  prefix: { color: colors.brand, marginRight: spacing.sm },
  input: {
    flex: 1,
    color: colors.onSurface,
    fontFamily: fonts.semibold,
    fontSize: fontSize.lg,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  timeRow: { flexDirection: "row", gap: spacing.md },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  modalActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  error: { color: colors.error, marginTop: spacing.sm },
});
