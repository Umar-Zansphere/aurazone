export const formatCurrencyINR = (value = 0) => {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatCompactCurrencyINR = (value = 0) => {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
};

export const formatRelativeTime = (dateInput) => {
  if (!dateInput) {
    return "now";
  }

  const input = new Date(dateInput);
  const diff = input.getTime() - Date.now();
  const abs = Math.abs(diff);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < minute) return "just now";

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  return rtf.format(Math.round(diff / day), "day");
};

export const statusTone = {
  PENDING: "var(--error)",
  PAID: "var(--info)",
  SHIPPED: "var(--warning)",
  DELIVERED: "var(--success)",
  CANCELLED: "#9ca3af",
};

export const shipmentTone = {
  PENDING: "var(--warning)",
  SHIPPED: "var(--info)",
  DELIVERED: "var(--success)",
  RETURNED: "var(--error)",
  LOST: "var(--error)",
};
