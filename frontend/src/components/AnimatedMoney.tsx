import React, { useEffect, useRef, useState } from "react";
import { Text, TextStyle, StyleProp } from "react-native";

import { formatMoney } from "@/src/utils/money";

// Smoothly tweens a displayed number toward `value` (money counter effect).
export function AnimatedMoney({
  value,
  currency = "INR",
  style,
  testID,
}: {
  value: number;
  currency?: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) {
  const [display, setDisplay] = useState(value);
  const raf = useRef<number | null>(null);
  const fromRef = useRef(value);
  const startRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    const duration = 500;
    startRef.current = 0;

    function step(ts: number) {
      if (!startRef.current) startRef.current = ts;
      const t = Math.min(1, (ts - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (t < 1) {
        raf.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    }

    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value]);

  return (
    <Text testID={testID} numberOfLines={1} adjustsFontSizeToFit style={style}>
      {formatMoney(display, currency)}
    </Text>
  );
}
