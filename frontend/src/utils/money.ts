// Indian-style currency formatting (lakh/crore grouping) for INR, generic otherwise.

const SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export function currencySymbol(currency: string = "INR"): string {
  return SYMBOLS[currency] ?? "₹";
}

function groupIndian(intStr: string): string {
  // last 3 digits, then groups of 2
  if (intStr.length <= 3) return intStr;
  const last3 = intStr.slice(-3);
  const rest = intStr.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return grouped + "," + last3;
}

export function formatMoney(
  amount: number,
  currency: string = "INR",
  opts: { decimals?: boolean; symbol?: boolean } = {},
): string {
  const { decimals = false, symbol = true } = opts;
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const rounded = decimals ? abs.toFixed(2) : String(Math.round(abs));
  const [intPart, decPart] = rounded.split(".");
  const grouped =
    currency === "INR"
      ? groupIndian(intPart)
      : intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sym = symbol ? currencySymbol(currency) : "";
  return `${sign}${sym}${grouped}${decPart ? "." + decPart : ""}`;
}
