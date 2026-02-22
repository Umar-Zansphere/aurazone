const ORDER_STATUSES = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const PAYMENT_STATUSES = ['PENDING', 'SUCCESS', 'FAILED'];
const SHIPMENT_STATUSES = ['PENDING', 'SHIPPED', 'DELIVERED', 'RETURNED', 'LOST'];
const PRODUCT_CATEGORIES = ['RUNNING', 'CASUAL', 'FORMAL', 'SNEAKERS'];
const PRODUCT_GENDERS = ['MEN', 'WOMEN', 'UNISEX', 'KIDS'];

const parseBool = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (['true', '1', 'yes'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no'].includes(normalized)) {
    return false;
  }

  return undefined;
};

const parseNumber = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseInteger = (value, fallback) => {
  const parsed = parseNumber(value, fallback);
  return Number.isInteger(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
};

const toDateOnly = (date) => {
  return date.toISOString().slice(0, 10);
};

const startOfUtcDay = (value = new Date()) => {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));
};

const endOfUtcDay = (value = new Date()) => {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999));
};

const addDaysUtc = (date, days) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const getPeriodRange = ({ period = '7d', startDate, endDate } = {}) => {
  const now = new Date();

  if (startDate || endDate) {
    const parsedStart = startDate ? new Date(`${startDate}T00:00:00.000Z`) : startOfUtcDay(now);
    const parsedEnd = endDate ? new Date(`${endDate}T23:59:59.999Z`) : endOfUtcDay(now);

    if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
      throw new Error('Invalid startDate or endDate. Expected YYYY-MM-DD');
    }

    return { start: parsedStart, end: parsedEnd };
  }

  const todayStart = startOfUtcDay(now);
  const todayEnd = endOfUtcDay(now);

  switch (period) {
    case 'today':
      return { start: todayStart, end: todayEnd };
    case '7d':
      return { start: addDaysUtc(todayStart, -6), end: todayEnd };
    case '30d':
      return { start: addDaysUtc(todayStart, -29), end: todayEnd };
    case '90d':
      return { start: addDaysUtc(todayStart, -89), end: todayEnd };
    default:
      throw new Error('Invalid period. Allowed: today, 7d, 30d, 90d');
  }
};

const parsePagination = (query, defaultTake = 20, maxTake = 100) => {
  const skip = Math.max(0, parseInteger(query.skip, 0));
  const take = clamp(Math.max(1, parseInteger(query.take, defaultTake)), 1, maxTake);

  return { skip, take };
};

const buildPagination = (total, skip, take) => ({
  total,
  skip,
  take,
  pages: total > 0 ? Math.ceil(total / take) : 0,
});

const buildOrderStatusTimeline = (order, shipment) => {
  const timeline = [
    {
      status: 'PENDING',
      timestamp: order.createdAt,
    },
  ];

  const successfulPayment = (order.payments || [])
    .filter((payment) => payment.status === 'SUCCESS')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];

  if (successfulPayment) {
    timeline.push({
      status: 'PAID',
      timestamp: successfulPayment.paidAt || successfulPayment.createdAt,
    });
  } else if (order.paymentStatus === 'SUCCESS' || order.status === 'PAID') {
    timeline.push({
      status: 'PAID',
      timestamp: order.createdAt,
    });
  }

  if (shipment && shipment.status === 'SHIPPED') {
    timeline.push({
      status: 'SHIPPED',
      timestamp: shipment.shippedAt || shipment.createdAt || order.createdAt,
    });
  }

  if (order.status === 'DELIVERED') {
    timeline.push({
      status: 'DELIVERED',
      timestamp: shipment?.shippedAt || shipment?.createdAt || order.createdAt,
    });
  }

  if (order.status === 'CANCELLED') {
    timeline.push({
      status: 'CANCELLED',
      timestamp: order.createdAt,
    });
  }

  const deduped = [];
  const seen = new Set();

  for (const entry of timeline) {
    if (!seen.has(entry.status)) {
      seen.add(entry.status);
      deduped.push({
        status: entry.status,
        timestamp: new Date(entry.timestamp).toISOString(),
      });
    }
  }

  return deduped.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

const parseTagsInput = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean).map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter(Boolean).map((tag) => String(tag).trim()).filter(Boolean);
        }
      } catch (error) {
        // Fall back to CSV parsing.
      }
    }

    return trimmed
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
};

const parseVariantsInput = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      throw new Error('variants must be a JSON array');
    }
    return parsed;
  }

  throw new Error('variants must be a JSON array');
};

const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
});

module.exports = {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  SHIPMENT_STATUSES,
  PRODUCT_CATEGORIES,
  PRODUCT_GENDERS,
  parseBool,
  parseInteger,
  parseNumber,
  toNumber,
  toDateOnly,
  startOfUtcDay,
  endOfUtcDay,
  addDaysUtc,
  getPeriodRange,
  parsePagination,
  buildPagination,
  buildOrderStatusTimeline,
  parseTagsInput,
  parseVariantsInput,
  getCookieOptions,
};
