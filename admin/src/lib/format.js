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
  PENDING: "#b7791f",
  PAID: "#3b6b8c",
  SHIPPED: "#a18a68",
  DELIVERED: "#2f6b4f",
  CANCELLED: "#9a9a9a",
};

export const shipmentTone = {
  PENDING: "#b7791f",
  SHIPPED: "#3b6b8c",
  DELIVERED: "#2f6b4f",
  RETURNED: "#9b2c2c",
  LOST: "#9b2c2c",
};

export const paymentTone = {
  PENDING: "#b7791f",
  COMPLETED: "#2f6b4f",
  PAID: "#2f6b4f",
  FAILED: "#9b2c2c",
  REFUNDED: "#3b6b8c",
  CANCELLED: "#9a9a9a",
};

export const formatDate = (dateInput) => {
  if (!dateInput) return "—";
  return new Date(dateInput).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const formatDateTime = (dateInput) => {
  if (!dateInput) return "—";
  return new Date(dateInput).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};
