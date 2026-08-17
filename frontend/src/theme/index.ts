// Spoilancer theme tokens — derived from /app/design_guidelines.json
// Personality: "6 Glass / Luxe DARK" — cinematic, premium, flowy.

export const colors = {
  surface: "#0B0B0E",
  onSurface: "#F2F2F5",
  surfaceSecondary: "#16161A",
  onSurfaceSecondary: "#A1A1AA",
  surfaceTertiary: "#222228",
  onSurfaceTertiary: "#8A8A93",
  surfaceInverse: "#F5F5F5",
  onSurfaceInverse: "#0B0B0E",

  brand: "#E6C998",
  brandPrimary: "#D4AF37",
  onBrandPrimary: "#0B0B0E",
  brandSecondary: "#C5A059",
  brandTertiary: "#2E281F",
  onBrandTertiary: "#E6C998",

  success: "#00C781",
  onSuccess: "#003320",
  warning: "#F5A623",
  onWarning: "#332100",
  error: "#E5484D",
  onError: "#330A0B",
  info: "#8E8E93",

  border: "#222228",
  borderStrong: "#3A3A40",
  divider: "#1F1F24",

  // helpers
  glassTint: "rgba(22,22,26,0.72)",
  scrim: "rgba(11,11,14,0.55)",
} as const;

export const fonts = {
  display: "Fraunces-Bold",
  displayBlack: "Fraunces-Black",
  displaySemi: "Fraunces-SemiBold",
  displayRegular: "Fraunces-Regular",
  regular: "Manrope-Regular",
  medium: "Manrope-Medium",
  semibold: "Manrope-SemiBold",
  bold: "Manrope-Bold",
  extrabold: "Manrope-ExtraBold",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const fontSize = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 38,
  "5xl": 48,
} as const;
