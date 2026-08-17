import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";

type ToastType = "success" | "error" | "info";
interface ToastCtx {
  show: (message: string, type?: ToastType) => void;
}
const Ctx = createContext<ToastCtx>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string>("");
  const [type, setType] = useState<ToastType>("info");
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);
  const timer = useRef<any>(null);

  const hide = useCallback(() => setMsg(""), []);

  const show = useCallback(
    (message: string, t: ToastType = "info") => {
      setMsg(message);
      setType(t);
      opacity.value = withSequence(
        withTiming(1, { duration: 220 }),
        withDelay(2200, withTiming(0, { duration: 300 }, (fin) => {
          if (fin) runOnJS(hide)();
        })),
      );
      translateY.value = withSequence(
        withTiming(0, { duration: 220 }),
        withDelay(2200, withTiming(-20, { duration: 300 })),
      );
    },
    [hide],
  );

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const color =
    type === "success" ? colors.success : type === "error" ? colors.error : colors.brand;
  const iconName =
    type === "success" ? "checkmark-circle" : type === "error" ? "alert-circle" : "information-circle";

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {msg ? (
        <Animated.View pointerEvents="none" style={[styles.wrap, style]}>
          <View style={[styles.toast, { borderColor: color }]}>
            <Ionicons name={iconName as any} size={20} color={color} />
            <View style={{ flex: 1 }}>
              <Animated.Text style={styles.text}>{msg}</Animated.Text>
            </View>
          </View>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 60,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    maxWidth: 500,
    width: "100%",
  },
  text: {
    color: colors.onSurface,
    fontFamily: fonts.semibold,
    fontSize: fontSize.base,
  },
});
