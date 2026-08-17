import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { colors, radius } from "@/src/theme";

export function ProgressBar({ progress }: { progress: number }) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withTiming(Math.max(0, Math.min(1, progress)), {
      duration: 650,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    width: `${p.value * 100}%`,
  }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fillWrap, style]}>
        <LinearGradient
          colors={[colors.brandSecondary, colors.brand, colors.brandPrimary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    overflow: "hidden",
  },
  fillWrap: {
    height: "100%",
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  fill: { flex: 1, borderRadius: radius.pill },
});
