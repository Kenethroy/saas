export function formatCurrency(amount, currency = "PHP") {
  if (amount === null || amount === undefined || amount === "") {
    return "Custom";
  }

  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency
    }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toLocaleString()}`;
  }
}

export function formatDateTime(value) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function formatStatusLabel(value) {
  return String(value ?? "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatJsonPreview(value) {
  if (!value) {
    return "{}";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
