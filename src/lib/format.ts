export function money(n: number | null | undefined, currency = "USD") {
  const v = Number(n ?? 0);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(v);
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
}

export function num(n: number | null | undefined, digits = 2) {
  return Number(n ?? 0).toFixed(digits);
}
