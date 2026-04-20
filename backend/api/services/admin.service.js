const prisma = require('../../config/prisma');
const { createError } = require('../../utils/error');
const { uploadBufferToS3 } = require('../services/s3.services');
const notificationService = require('./notification.service');
const { sendEmail } = require('../../config/email');
const { validateAndOptimizeImage } = require('../../utils/imageProcessor');
const { randomUUID } = require('node:crypto');

const ORDER_STATUSES = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const PAYMENT_STATUSES = ['PENDING', 'SUCCESS', 'FAILED'];
const PAYMENT_GATEWAYS = ['RAZORPAY', 'COD'];
const SHIPMENT_STATUSES = ['PENDING', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'LOST', 'FAILED'];
const INVENTORY_LOG_TYPES = ['HOLD', 'RELEASE', 'SOLD', 'MANUAL', 'RESTOCK', 'RETURN'];
const INVENTORY_ADJUST_OPERATIONS = ['SET', 'RESTOCK', 'REDUCE', 'HOLD', 'RELEASE', 'RETURN'];
const PRODUCT_CATEGORIES = ['RUNNING', 'CASUAL', 'FORMAL', 'SNEAKERS'];
const PRODUCT_GENDERS = ['MEN', 'WOMEN', 'UNISEX', 'KIDS'];
const ORDER_STATUS_LABELS = {
  PENDING: 'Pending',
  PAID: 'Paid',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RECEIVED: 'Received',
  SUCCESS: 'Completed',
  FAILED: 'Failed',
};
const PAYMENT_STATUS_LABELS = {
  PENDING: 'Pending',
  SUCCESS: 'Paid',
  FAILED: 'Failed',
};

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
      timestamp: order.deletedAt || order.createdAt,
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

const parseJsonInput = (value, fieldName = 'value') => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw createError(400, `${fieldName} must be valid JSON`);
    }
  }

  if (typeof value === 'object' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  throw createError(400, `${fieldName} must be valid JSON`);
};

const normalizeColorKey = (value) => String(value || '').trim().toLowerCase();

const sanitizePathSegment = (value, fallback = 'item') => {
  const sanitized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || fallback;
};

const parseProductColorImageGroups = (value) => {
  const parsed = parseJsonInput(value, 'colorImageGroups');
  if (parsed === undefined || parsed === null) {
    return [];
  }

  if (!Array.isArray(parsed)) {
    throw createError(400, 'colorImageGroups must be a JSON array');
  }

  return parsed.map((group, index) => {
    if (!group || typeof group !== 'object' || Array.isArray(group)) {
      throw createError(400, `Invalid colorImageGroups item at index ${index}`);
    }

    const fieldName = String(group.fieldName || '').trim();
    if (!fieldName) {
      throw createError(400, `colorImageGroups item ${index} requires fieldName`);
    }

    const colors = [];
    const seenColorKeys = new Set();
    const rawColors = Array.isArray(group.colors) ? group.colors : [];
    rawColors.forEach((color) => {
      const colorName = String(color || '').trim();
      const colorKey = normalizeColorKey(colorName);
      if (!colorKey || seenColorKeys.has(colorKey)) {
        return;
      }

      seenColorKeys.add(colorKey);
      colors.push(colorName);
    });

    if (colors.length === 0) {
      throw createError(400, `colorImageGroups item ${index} requires at least one color`);
    }

    return {
      fieldName,
      colors,
      colorKeys: colors.map(normalizeColorKey),
    };
  });
};

const parseDateTimeInput = (value, fieldName) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createError(400, `${fieldName} must be a valid date`);
  }

  return parsed;
};

const parseNullableTextInput = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
};

const parseIdempotencyKey = (req) => {
  const headerRaw = typeof req.get === 'function' ? req.get('Idempotency-Key') : req.headers?.['idempotency-key'];
  const header = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  const parsedHeader = parseNullableTextInput(header);

  if (parsedHeader !== undefined) {
    return parsedHeader;
  }

  return parseNullableTextInput(req.body?.idempotencyKey);
};

const areAmountsEqual = (left, right) => {
  const a = Number(left);
  const b = Number(right);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.0001;
};

const assertPaymentReferences = ({
  gateway,
  status,
  gatewayOrderId,
  gatewayPaymentId,
  externalReference,
  context,
}) => {
  const hasGatewayOrderId = Boolean(gatewayOrderId);
  const hasGatewayPaymentId = Boolean(gatewayPaymentId);
  const hasExternalReference = Boolean(externalReference);
  const target = context || 'payment';

  if (gateway === 'RAZORPAY') {
    if (status === 'SUCCESS') {
      if (!hasGatewayOrderId) {
        throw createError(400, `${target}: gatewayOrderId is required for RAZORPAY SUCCESS payments`);
      }

      if (!hasGatewayPaymentId) {
        throw createError(400, `${target}: gatewayPaymentId is required for RAZORPAY SUCCESS payments`);
      }
    } else if (!hasGatewayOrderId && !hasGatewayPaymentId && !hasExternalReference) {
      throw createError(400, `${target}: provide at least one external reference (gatewayOrderId, gatewayPaymentId, or externalReference)`);
    }
  }
};

const assertIdempotentPaymentPayload = (existingPayment, expectedPayload) => {
  const mismatchedFields = [];

  if (existingPayment.gateway !== expectedPayload.gateway) {
    mismatchedFields.push('gateway');
  }
  if ((existingPayment.gatewayOrderId || null) !== (expectedPayload.gatewayOrderId || null)) {
    mismatchedFields.push('gatewayOrderId');
  }
  if ((existingPayment.gatewayPaymentId || null) !== (expectedPayload.gatewayPaymentId || null)) {
    mismatchedFields.push('gatewayPaymentId');
  }
  if ((existingPayment.externalReference || null) !== (expectedPayload.externalReference || null)) {
    mismatchedFields.push('externalReference');
  }
  if (!areAmountsEqual(existingPayment.amount, expectedPayload.amount)) {
    mismatchedFields.push('amount');
  }
  if (existingPayment.status !== expectedPayload.status) {
    mismatchedFields.push('status');
  }

  if (mismatchedFields.length > 0) {
    throw createError(409, `idempotencyKey already exists with different values (${mismatchedFields.join(', ')})`);
  }
};

const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const ensureEnumValue = (value, allowed, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const normalized = String(value).trim().toUpperCase();

  if (!allowed.includes(normalized)) {
    throw createError(400, `Invalid ${fieldName}. Allowed: ${allowed.join('|')}`);
  }

  return normalized;
};

const parseDateFilter = (startDate, endDate, fieldName = 'date range') => {
  if (!startDate && !endDate) {
    return undefined;
  }

  const parsedStart = startDate
    ? new Date(`${startDate}T00:00:00.000Z`)
    : new Date('1970-01-01T00:00:00.000Z');
  const parsedEnd = endDate
    ? new Date(`${endDate}T23:59:59.999Z`)
    : new Date();

  if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
    throw createError(400, `Invalid ${fieldName}. Expected YYYY-MM-DD`);
  }

  if (parsedStart > parsedEnd) {
    throw createError(400, `${fieldName} start date must be before end date`);
  }

  return {
    gte: parsedStart,
    lte: parsedEnd,
  };
};

const getAdminActor = (req) => ({
  adminId: req.user?.id || null,
  performedBy: req.user?.id || 'admin',
});

const ensureLockedInventoryRowTx = async (tx, variantId) => {
  const existingInventory = await tx.inventory.findUnique({
    where: { variantId },
    select: { id: true },
  });

  if (!existingInventory) {
    try {
      await tx.inventory.create({
        data: {
          variantId,
          quantity: 0,
          reserved: 0,
        },
      });
    } catch (error) {
      if (error?.code !== 'P2002') {
        throw error;
      }
    }
  }

  const rows = await tx.$queryRaw`
    SELECT "id", "quantity", "reserved"
    FROM "Inventory"
    WHERE "variantId" = ${variantId}
    FOR UPDATE
  `;

  const row = rows?.[0];

  if (!row) {
    throw createError(500, 'Inventory row could not be locked');
  }

  return {
    id: row.id,
    quantity: Number(row.quantity),
    reserved: Number(row.reserved),
  };
};

const createOrderLogTx = async (tx, {
  orderId,
  orderNumber,
  adminId,
  action,
  fromStatus,
  toStatus,
  fromPaymentStatus,
  toPaymentStatus,
  note,
  metadata,
}) => {
  return tx.orderLog.create({
    data: {
      orderId: orderId || null,
      orderNumberSnapshot: orderNumber || null,
      adminId: adminId || null,
      action,
      ...(fromStatus !== undefined ? { fromStatus } : {}),
      ...(toStatus !== undefined ? { toStatus } : {}),
      ...(fromPaymentStatus !== undefined ? { fromPaymentStatus } : {}),
      ...(toPaymentStatus !== undefined ? { toPaymentStatus } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
    },
  });
};

const createShipmentLogTx = async (tx, {
  orderId,
  orderNumber,
  shipmentId,
  adminId,
  action,
  fromStatus,
  toStatus,
  courierName,
  trackingNumber,
  trackingUrl,
  note,
  metadata,
}) => {
  return tx.shipmentLog.create({
    data: {
      orderId: orderId || null,
      orderNumberSnapshot: orderNumber || null,
      shipmentId: shipmentId || null,
      adminId: adminId || null,
      action,
      ...(fromStatus !== undefined ? { fromStatus } : {}),
      ...(toStatus !== undefined ? { toStatus } : {}),
      ...(courierName !== undefined ? { courierName } : {}),
      ...(trackingNumber !== undefined ? { trackingNumber } : {}),
      ...(trackingUrl !== undefined ? { trackingUrl } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
    },
  });
};

const createPaymentLogTx = async (tx, {
  paymentId,
  orderId,
  orderNumber,
  adminId,
  action,
  fromStatus,
  toStatus,
  amount,
  note,
  metadata,
}) => {
  return tx.paymentLog.create({
    data: {
      paymentId: paymentId || null,
      orderId: orderId || null,
      orderNumberSnapshot: orderNumber || null,
      adminId: adminId || null,
      action,
      ...(fromStatus !== undefined ? { fromStatus } : {}),
      ...(toStatus !== undefined ? { toStatus } : {}),
      ...(amount !== undefined ? { amount } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
    },
  });
};

const deriveOrderPaymentStatus = (paymentStatuses) => {
  const counts = paymentStatuses.reduce((acc, status) => {
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  if (counts.SUCCESS > 0) {
    return 'SUCCESS';
  }
  if (counts.PENDING > 0) {
    return 'PENDING';
  }
  if (counts.FAILED > 0) {
    return 'FAILED';
  }

  return 'PENDING';
};

const syncOrderPaymentStateTx = async (tx, orderId) => {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
    },
  });

  if (!order) {
    throw createError(404, 'Order not found');
  }

  const paymentRows = await tx.payment.findMany({
    where: {
      orderId,
      deletedAt: null,
    },
    select: { status: true },
  });

  const nextPaymentStatus = deriveOrderPaymentStatus(paymentRows.map((entry) => entry.status));
  const nextOrderStatus = (nextPaymentStatus === 'SUCCESS' && order.status === 'PENDING')
    ? 'PAID'
    : (nextPaymentStatus !== 'SUCCESS' && order.status === 'PAID')
      ? 'PENDING'
      : order.status;

  if (order.paymentStatus !== nextPaymentStatus || order.status !== nextOrderStatus) {
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: nextPaymentStatus,
        ...(nextOrderStatus !== order.status ? { status: nextOrderStatus } : {}),
      },
    });
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    fromPaymentStatus: order.paymentStatus,
    toPaymentStatus: nextPaymentStatus,
    fromStatus: order.status,
    toStatus: nextOrderStatus,
  };
};

const releaseReservedInventoryForOrderItemsTx = async (tx, {
  orderId,
  orderItems = [],
  note,
}) => {
  const groupedItemsByVariant = new Map();

  for (const item of orderItems) {
    if (!item?.variantId) {
      continue;
    }

    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    groupedItemsByVariant.set(
      item.variantId,
      (groupedItemsByVariant.get(item.variantId) || 0) + quantity
    );
  }

  if (groupedItemsByVariant.size === 0) {
    return {
      releasedVariantCount: 0,
      releasedQuantity: 0,
    };
  }

  const inventoryLogs = [];
  let releasedQuantity = 0;

  for (const [variantId, requestedQuantity] of groupedItemsByVariant) {
    const lockedInventory = await ensureLockedInventoryRowTx(tx, variantId);
    const releaseQuantity = Math.min(requestedQuantity, Math.max(0, lockedInventory.reserved));

    if (releaseQuantity <= 0) {
      continue;
    }

    await tx.inventory.update({
      where: { variantId },
      data: {
        reserved: {
          decrement: releaseQuantity,
        },
      },
    });

    inventoryLogs.push({
      variantId,
      orderId,
      type: 'RELEASE',
      quantity: releaseQuantity,
      note: note || null,
    });
    releasedQuantity += releaseQuantity;
  }

  if (inventoryLogs.length > 0) {
    await tx.inventoryLog.createMany({
      data: inventoryLogs,
    });
  }

  return {
    releasedVariantCount: inventoryLogs.length,
    releasedQuantity,
  };
};

const formatImage = (image) => ({
  id: image.id,
  url: image.url,
  altText: image.altText,
  position: image.position,
  isPrimary: image.isPrimary,
});

const formatVariant = (variant, includeInventory = true) => ({
  id: variant.id,
  size: variant.size,
  color: variant.color,
  sku: variant.sku,
  price: toNumber(variant.price),
  compareAtPrice: toNumber(variant.compareAtPrice),
  isAvailable: variant.isAvailable,
  images: (variant.images || []).sort((a, b) => a.position - b.position).map(formatImage),
  ...(includeInventory
    ? {
      inventory: variant.inventory
        ? {
          id: variant.inventory.id,
          quantity: variant.inventory.quantity,
          reserved: variant.inventory.reserved,
        }
        : null,
    }
    : {}),
});

const formatInventoryRow = (variant) => ({
  variantId: variant.id,
  sku: variant.sku,
  size: variant.size,
  color: variant.color,
  isAvailable: variant.isAvailable,
  product: {
    id: variant.product.id,
    name: variant.product.name,
    brand: variant.product.brand,
    category: variant.product.category,
    gender: variant.product.gender,
  },
  inventory: {
    id: variant.inventory?.id || null,
    quantity: variant.inventory?.quantity || 0,
    reserved: variant.inventory?.reserved || 0,
    available: Math.max(0, (variant.inventory?.quantity || 0) - (variant.inventory?.reserved || 0)),
    updatedAt: variant.inventory?.updatedAt ? variant.inventory.updatedAt.toISOString() : null,
  },
});

const formatProduct = (product) => ({
  id: product.id,
  name: product.name,
  brand: product.brand,
  modelNumber: product.modelNumber,
  category: product.category,
  gender: product.gender,
  description: product.description,
  shortDescription: product.shortDescription,
  tags: product.tags,
  isActive: product.isActive,
  isFeatured: product.isFeatured,
  createdAt: product.createdAt.toISOString(),
  updatedAt: product.updatedAt ? product.updatedAt.toISOString() : null,
  variants: (product.variants || []).map((variant) => formatVariant(variant, true)),
});

const formatOrderSummary = (order) => {
  const latestShipment = order.shipments?.[0] || null;
  const customer = {
    id: order.user?.id || null,
    fullName: order.user?.fullName || order.orderAddress?.name || null,
    email: order.user?.email || order.orderAddress?.email || null,
    phone: order.user?.phone || order.orderAddress?.phone || null,
  };

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    totalAmount: toNumber(order.totalAmount),
    isDeleted: Boolean(order.deletedAt),
    deletedAt: order.deletedAt ? order.deletedAt.toISOString() : null,
    deleteReason: order.deleteReason || null,
    createdAt: order.createdAt.toISOString(),
    customer,
    itemsCount: (order.items || []).reduce((acc, item) => acc + item.quantity, 0),
    shipment: latestShipment
      ? {
        id: latestShipment.id,
        courierName: latestShipment.courierName,
        trackingNumber: latestShipment.trackingNumber,
        trackingUrl: latestShipment.trackingUrl,
        status: latestShipment.status,
        shippedAt: latestShipment.shippedAt ? latestShipment.shippedAt.toISOString() : null,
      }
      : null,
  };
};

const formatFullOrder = (order) => {
  const latestShipment = (order.shipments || []).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  )[0] || null;
  const sortedPayments = [...(order.payments || [])].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  const latestPayment = sortedPayments.find((payment) => !payment.deletedAt) || sortedPayments[0] || null;
  const formattedPayments = (order.payments || []).map((payment) => ({
    id: payment.id,
    gateway: payment.gateway,
    gatewayOrderId: payment.gatewayOrderId || null,
    gatewayPaymentId: payment.gatewayPaymentId || null,
    externalReference: payment.externalReference || null,
    amount: toNumber(payment.amount),
    status: payment.status,
    paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
    note: payment.note || null,
    metadata: payment.metadata || null,
    isDeleted: Boolean(payment.deletedAt),
    deletedAt: payment.deletedAt ? payment.deletedAt.toISOString() : null,
    deleteReason: payment.deleteReason || null,
    createdAt: payment.createdAt ? payment.createdAt.toISOString() : null,
    updatedAt: payment.updatedAt ? payment.updatedAt.toISOString() : null,
  }));

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    trackingToken: order.trackingToken,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    razorpayOrderId: order.razorpayOrderId,
    razorpayPaymentId: order.razorpayPaymentId,
    totalAmount: toNumber(order.totalAmount),
    isDeleted: Boolean(order.deletedAt),
    deletedAt: order.deletedAt ? order.deletedAt.toISOString() : null,
    deleteReason: order.deleteReason || null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt ? order.updatedAt.toISOString() : null,
    customer: {
      id: order.user?.id || null,
      fullName: order.user?.fullName || order.orderAddress?.name || null,
      email: order.user?.email || order.orderAddress?.email || null,
      phone: order.user?.phone || order.orderAddress?.phone || null,
    },
    items: (order.items || []).map((item) => {
      const primaryImage = (item.variant?.images || []).find((image) => image.isPrimary)
        || (item.variant?.images || [])[0]
        || null;

      return {
        id: item.id,
        productName: item.productName,
        color: item.color,
        size: item.size,
        price: toNumber(item.price),
        quantity: item.quantity,
        subtotal: toNumber(item.subtotal),
        imageUrl: primaryImage?.url || null,
      };
    }),
    orderAddress: order.orderAddress
      ? {
        name: order.orderAddress.name,
        phone: order.orderAddress.phone,
        addressLine1: order.orderAddress.addressLine1,
        addressLine2: order.orderAddress.addressLine2,
        city: order.orderAddress.city,
        state: order.orderAddress.state,
        postalCode: order.orderAddress.postalCode,
        country: order.orderAddress.country,
      }
      : null,
    shipment: latestShipment
      ? {
        id: latestShipment.id,
        courierName: latestShipment.courierName,
        trackingNumber: latestShipment.trackingNumber,
        trackingUrl: latestShipment.trackingUrl,
        status: latestShipment.status,
        shippedAt: latestShipment.shippedAt ? latestShipment.shippedAt.toISOString() : null,
      }
      : null,
    // Backward-compatible field expected by existing admin order detail UI.
    payment: latestPayment
      ? {
        id: latestPayment.id,
        method: latestPayment.gateway,
        gateway: latestPayment.gateway,
        status: latestPayment.status === 'SUCCESS' ? 'PAID' : latestPayment.status,
        amount: toNumber(latestPayment.amount),
        transactionId: latestPayment.gatewayPaymentId || latestPayment.externalReference || null,
        gatewayOrderId: latestPayment.gatewayOrderId || null,
        gatewayPaymentId: latestPayment.gatewayPaymentId || null,
        externalReference: latestPayment.externalReference || null,
        paidAt: latestPayment.paidAt ? latestPayment.paidAt.toISOString() : null,
        note: latestPayment.note || null,
        metadata: latestPayment.metadata || null,
        isDeleted: Boolean(latestPayment.deletedAt),
        deletedAt: latestPayment.deletedAt ? latestPayment.deletedAt.toISOString() : null,
        deleteReason: latestPayment.deleteReason || null,
        createdAt: latestPayment.createdAt ? latestPayment.createdAt.toISOString() : null,
        updatedAt: latestPayment.updatedAt ? latestPayment.updatedAt.toISOString() : null,
      }
      : null,
    payments: formattedPayments,
    statusTimeline: buildOrderStatusTimeline(order, latestShipment),
    statusEmails: (order.statusEmailLogs || []).map(formatOrderStatusEmailLog),
  };
};

const formatPayment = (payment, includeOrder = false) => ({
  id: payment.id,
  orderId: payment.orderId,
  gateway: payment.gateway,
  gatewayOrderId: payment.gatewayOrderId || null,
  gatewayPaymentId: payment.gatewayPaymentId || null,
  externalReference: payment.externalReference || null,
  amount: toNumber(payment.amount),
  status: payment.status,
  paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
  note: payment.note || null,
  metadata: payment.metadata || null,
  idempotencyKey: payment.idempotencyKey || null,
  isDeleted: Boolean(payment.deletedAt),
  deletedAt: payment.deletedAt ? payment.deletedAt.toISOString() : null,
  deleteReason: payment.deleteReason || null,
  createdAt: payment.createdAt ? payment.createdAt.toISOString() : null,
  updatedAt: payment.updatedAt ? payment.updatedAt.toISOString() : null,
  ...(includeOrder
    ? {
      order: payment.order
        ? {
          id: payment.order.id,
          orderNumber: payment.order.orderNumber,
          status: payment.order.status,
          paymentStatus: payment.order.paymentStatus,
          totalAmount: toNumber(payment.order.totalAmount),
          createdAt: payment.order.createdAt.toISOString(),
          customer: {
            id: payment.order.user?.id || null,
            fullName: payment.order.user?.fullName || payment.order.orderAddress?.name || null,
            email: payment.order.user?.email || payment.order.orderAddress?.email || null,
            phone: payment.order.user?.phone || payment.order.orderAddress?.phone || null,
          },
        }
        : null,
    }
    : {}),
});

const formatShipment = (shipment, includeOrder = false) => ({
  id: shipment.id,
  orderId: shipment.orderId,
  courierName: shipment.courierName,
  trackingNumber: shipment.trackingNumber,
  trackingUrl: shipment.trackingUrl,
  status: shipment.status,
  shippedAt: shipment.shippedAt ? shipment.shippedAt.toISOString() : null,
  isDeleted: Boolean(shipment.deletedAt),
  deletedAt: shipment.deletedAt ? shipment.deletedAt.toISOString() : null,
  deleteReason: shipment.deleteReason || null,
  createdAt: shipment.createdAt ? shipment.createdAt.toISOString() : null,
  ...(includeOrder
    ? {
      order: shipment.order
        ? {
          id: shipment.order.id,
          orderNumber: shipment.order.orderNumber,
          status: shipment.order.status,
          paymentStatus: shipment.order.paymentStatus,
          createdAt: shipment.order.createdAt.toISOString(),
        }
        : null,
    }
    : {}),
});

const formatOrderLog = (log) => ({
  id: log.id,
  orderId: log.orderId,
  orderNumber: log.order?.orderNumber || log.orderNumberSnapshot || null,
  action: log.action,
  fromStatus: log.fromStatus,
  toStatus: log.toStatus,
  fromPaymentStatus: log.fromPaymentStatus,
  toPaymentStatus: log.toPaymentStatus,
  note: log.note,
  metadata: log.metadata,
  createdAt: log.createdAt.toISOString(),
  admin: log.admin
    ? {
      id: log.admin.id,
      fullName: log.admin.fullName,
      email: log.admin.email,
    }
    : null,
});

const formatOrderStatusEmailLog = (log) => ({
  id: log.id,
  orderId: log.orderId,
  statusSnapshot: log.statusSnapshot,
  recipientEmail: log.recipientEmail,
  template: log.template,
  subject: log.subject,
  providerMessageId: log.providerMessageId,
  state: log.state,
  errorMessage: log.errorMessage,
  metadata: log.metadata,
  sentAt: log.sentAt ? log.sentAt.toISOString() : null,
  createdAt: log.createdAt.toISOString(),
  updatedAt: log.updatedAt ? log.updatedAt.toISOString() : null,
  admin: log.admin
    ? {
      id: log.admin.id,
      fullName: log.admin.fullName,
      email: log.admin.email,
    }
    : null,
});

const formatShipmentLog = (log) => ({
  id: log.id,
  orderId: log.orderId,
  orderNumber: log.order?.orderNumber || log.orderNumberSnapshot || null,
  shipmentId: log.shipmentId,
  action: log.action,
  fromStatus: log.fromStatus,
  toStatus: log.toStatus,
  courierName: log.courierName,
  trackingNumber: log.trackingNumber,
  trackingUrl: log.trackingUrl,
  note: log.note,
  metadata: log.metadata,
  createdAt: log.createdAt.toISOString(),
  admin: log.admin
    ? {
      id: log.admin.id,
      fullName: log.admin.fullName,
      email: log.admin.email,
    }
    : null,
});

const formatPaymentLog = (log) => ({
  id: log.id,
  paymentId: log.paymentId,
  orderId: log.orderId,
  orderNumber: log.order?.orderNumber || log.orderNumberSnapshot || null,
  action: log.action,
  fromStatus: log.fromStatus,
  toStatus: log.toStatus,
  amount: toNumber(log.amount),
  note: log.note,
  metadata: log.metadata,
  createdAt: log.createdAt.toISOString(),
  admin: log.admin
    ? {
      id: log.admin.id,
      fullName: log.admin.fullName,
      email: log.admin.email,
    }
    : null,
});

// ======================== SHIPMENT EMAIL HELPER ========================

const sendShipmentUpdateEmail = async (shipment, order) => {
  try {
    const orderAddress = await prisma.orderAddress.findFirst({
      where: { orderId: order.id },
    });

    let email = null;
    let customerName = 'Valued Customer';

    if (order.userId) {
      const user = await prisma.user.findUnique({
        where: { id: order.userId },
      });
      if (user) {
        email = user.email;
        customerName = user.fullName;
      }
    } else if (order.sessionId) {
      email = orderAddress?.email;
      customerName = orderAddress?.name || 'Valued Customer';
    }

    if (!email) {
      console.error('Email not found for shipment update:', shipment.id);
      return;
    }

    const statusLabels = {
      PENDING: 'Pending',
      SHIPPED: 'Shipped',
      DELIVERED: 'Delivered',
      RETURNED: 'Returned',
      LOST: 'Lost',
      FAILED: 'Delivery Failed',
    };

    await sendEmail(
      email,
      `Shipment Update - ${order.orderNumber}`,
      'shipment-update',
      {
        customerName,
        orderNumber: order.orderNumber,
        orderId: order.id,
        trackingNumber: shipment.trackingNumber,
        courierName: shipment.courierName,
        trackingUrl: shipment.trackingUrl,
        status: shipment.status,
        statusLabel: statusLabels[shipment.status] || shipment.status,
        shippedDate: shipment.shippedAt,
        updatedDate: new Date(),
        note: shipment.note || '',
        addressLine1: orderAddress?.addressLine1 || '',
        addressLine2: orderAddress?.addressLine2 || '',
        city: orderAddress?.city || '',
        state: orderAddress?.state || '',
        postalCode: orderAddress?.postalCode || '',
        country: orderAddress?.country || '',
        phone: orderAddress?.phone || '',
      }
    );
  } catch (error) {
    console.error('Error sending shipment update email:', error);
  }
};

const sendOrderStatusUpdateEmail = async (order, { status, note } = {}) => {
  try {
    if (!['SHIPPED', 'DELIVERED', 'CANCELLED'].includes(status)) {
      return;
    }

    const email = order.user?.email || order.orderAddress?.email || null;
    const customerName = order.user?.fullName || order.orderAddress?.name || 'Valued Customer';

    if (!email) {
      console.error(`Email not found for order status update: ${order.id}`);
      return;
    }

    const latestShipment = (order.shipments || []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    )[0] || null;
    const trackingNumber = latestShipment?.trackingNumber || 'Not available';
    const shippedDate = latestShipment?.shippedAt || new Date();
    const estimatedDelivery = latestShipment?.shippedAt ? addDaysUtc(new Date(latestShipment.shippedAt), 5) : null;
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const trackingUrl = latestShipment?.trackingUrl
      || (order.userId ? `${clientUrl}/orders/${order.id}` : order.trackingToken ? `${clientUrl}/track-order/${order.trackingToken}` : `${clientUrl}/orders/${order.id}`);
    const reviewUrl = order.userId
      ? `${clientUrl}/orders/${order.id}`
      : order.trackingToken
        ? `${clientUrl}/track-order/${order.trackingToken}`
        : `${clientUrl}/orders/${order.id}`;
    const items = (order.items || []).map((item) => ({
      productName: item.productName,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      price: toNumber(item.price) || 0,
      subtotal: toNumber(item.subtotal) || ((toNumber(item.price) || 0) * item.quantity),
    }));
    const deliveredAddress = [
      order.orderAddress?.addressLine1,
      order.orderAddress?.addressLine2,
      order.orderAddress?.city,
      order.orderAddress?.state,
      order.orderAddress?.postalCode,
      order.orderAddress?.country,
    ]
      .filter(Boolean)
      .join(', ');

    if (status === 'SHIPPED') {
      await sendEmail(
        email,
        `Order Shipped - ${order.orderNumber}`,
        'order-shipped',
        {
          customerName,
          orderNumber: order.orderNumber,
          orderId: order.id,
          trackingNumber: latestShipment?.trackingNumber || null,
          shippedDate,
          carrier: latestShipment?.courierName || null,
          estimatedDelivery,
          addressLine1: order.orderAddress?.addressLine1 || '',
          addressLine2: order.orderAddress?.addressLine2 || '',
          city: order.orderAddress?.city || '',
          state: order.orderAddress?.state || '',
          postalCode: order.orderAddress?.postalCode || '',
          country: order.orderAddress?.country || '',
          phone: order.orderAddress?.phone || order.user?.phone || '',
          items,
          trackingUrl,
        }
      );
      return;
    }

    if (status === 'DELIVERED') {
      await sendEmail(
        email,
        `Order Delivered - ${order.orderNumber}`,
        'delivery-confirmed',
        {
          customerName,
          orderNumber: order.orderNumber,
          orderId: order.id,
          trackingNumber,
          deliveryDate: new Date(),
          deliveredAddress: deliveredAddress || 'Your specified address',
          receivedBy: customerName,
          signature: false,
          items,
          totalAmount: toNumber(order.totalAmount) || 0,
          reviewUrl,
        }
      );
      return;
    }

    const shouldIncludeRefund = order.paymentMethod === 'RAZORPAY' && order.paymentStatus === 'SUCCESS';
    await sendEmail(
      email,
      `Order Cancelled - ${order.orderNumber}`,
      'order-cancelled',
      {
        customerName,
        orderNumber: order.orderNumber,
        orderId: order.id,
        createdAt: order.createdAt,
        cancelledDate: new Date(),
        reason: note || 'Cancelled by admin',
        paymentMethod: order.paymentMethod,
        items,
        ...(shouldIncludeRefund
          ? {
            refundStatus: 'Processing',
            refundAmount: toNumber(order.totalAmount) || 0,
            refundProcessingTime: '5-7 business days',
            expectedRefundDate: addDaysUtc(new Date(), 7),
          }
          : {}),
      }
    );
  } catch (error) {
    console.error('Error sending order status update email:', error);
  }
};

const getOrderForStatusEmail = async (orderId) => {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
        },
      },
      orderAddress: {
        select: {
          name: true,
          email: true,
          phone: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
        },
      },
      items: {
        select: {
          productName: true,
          color: true,
          size: true,
          quantity: true,
          price: true,
          subtotal: true,
        },
      },
      shipments: {
        where: {
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });
};

const buildOrderTrackingUrl = (order, shipment = null) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  if (shipment?.trackingUrl) {
    return shipment.trackingUrl;
  }
  if (order.userId) {
    return `${clientUrl}/orders/${order.id}`;
  }
  if (order.trackingToken) {
    return `${clientUrl}/track-order/${order.trackingToken}`;
  }

  return `${clientUrl}/orders/${order.id}`;
};

const buildOrderStatusShareEmailPayload = (order, statusSnapshot, note) => {
  const latestShipment = (order.shipments || []).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  )[0] || null;
  const statusLabel = ORDER_STATUS_LABELS[statusSnapshot] || statusSnapshot;
  const paymentStatusLabel = PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus;
  const customerName = order.user?.fullName || order.orderAddress?.name || 'Valued Customer';
  const recipientEmail = order.user?.email || order.orderAddress?.email || null;

  return {
    recipientEmail,
    subject: `Order Status Update - ${order.orderNumber}`,
    template: 'order-status-share',
    data: {
      customerName,
      orderNumber: order.orderNumber,
      orderId: order.id,
      statusSnapshot,
      statusLabel,
      paymentStatus: order.paymentStatus,
      paymentStatusLabel,
      updatedAt: new Date(),
      trackingNumber: latestShipment?.trackingNumber || null,
      courierName: latestShipment?.courierName || null,
      trackingUrl: buildOrderTrackingUrl(order, latestShipment),
      note: note || '',
      totalAmount: toNumber(order.totalAmount) || 0,
      items: (order.items || []).map((item) => ({
        productName: item.productName,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
      })),
    },
  };
};

const normalizeEmailError = (error) => {
  if (error?.message && typeof error.message === 'string') {
    return error.message;
  }

  return 'Failed to send email.';
};

const sendOrderStatusEmailWithLog = async ({
  order,
  adminId,
  statusSnapshot,
  note,
  source,
  resendOfLogId,
}) => {
  const payload = buildOrderStatusShareEmailPayload(order, statusSnapshot, note);
  let state = 'FAILED';
  let providerMessageId = null;
  let errorMessage = null;
  let sentAt = null;

  if (!payload.recipientEmail) {
    errorMessage = 'Customer email not found for this order.';
  } else {
    try {
      const emailResult = await sendEmail(
        payload.recipientEmail,
        payload.subject,
        payload.template,
        payload.data
      );
      state = 'SENT';
      providerMessageId = emailResult?.id || null;
      sentAt = new Date();
    } catch (error) {
      errorMessage = normalizeEmailError(error);
    }
  }

  const emailLog = await prisma.$transaction(async (tx) => {
    const createdLog = await tx.orderStatusEmailLog.create({
      data: {
        orderId: order.id,
        adminId: adminId || null,
        recipientEmail: payload.recipientEmail,
        statusSnapshot,
        template: payload.template,
        subject: payload.subject,
        providerMessageId,
        state,
        errorMessage,
        metadata: {
          source,
          note: note || null,
          resendOfLogId: resendOfLogId || null,
        },
        sentAt,
      },
      include: {
        admin: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    await createOrderLogTx(tx, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      adminId: adminId || null,
      action: state === 'SENT'
        ? (resendOfLogId ? 'STATUS_EMAIL_RESENT' : 'STATUS_EMAIL_SHARED')
        : (resendOfLogId ? 'STATUS_EMAIL_RESEND_FAILED' : 'STATUS_EMAIL_SHARE_FAILED'),
      note: state === 'SENT'
        ? `Status email sent to ${payload.recipientEmail}`
        : errorMessage,
      metadata: {
        source,
        statusSnapshot,
        recipientEmail: payload.recipientEmail,
        template: payload.template,
        providerMessageId,
        resendOfLogId: resendOfLogId || null,
      },
    });

    return createdLog;
  });

  return {
    sent: state === 'SENT',
    emailLog,
  };
};

const shareOrderStatusEmail = async (req, res) => {
  const { orderId } = req.params;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  const { adminId } = getAdminActor(req);

  const order = await getOrderForStatusEmail(orderId);

  if (!order) {
    throw createError(404, 'Order not found');
  }

  const result = await sendOrderStatusEmailWithLog({
    order,
    adminId,
    statusSnapshot: order.status,
    note,
    source: 'ADMIN_SHARE_STATUS_EMAIL',
  });

  return res.status(200).json({
    sent: result.sent,
    message: result.sent
      ? 'Status email sent successfully.'
      : 'Status email could not be sent. Failure has been logged.',
    emailLog: formatOrderStatusEmailLog(result.emailLog),
  });
};

const resendOrderStatusEmail = async (req, res) => {
  const { orderId, emailLogId } = req.params;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  const { adminId } = getAdminActor(req);

  const sourceLog = await prisma.orderStatusEmailLog.findFirst({
    where: {
      id: emailLogId,
      orderId,
    },
  });

  if (!sourceLog) {
    throw createError(404, 'Status email log not found for this order');
  }

  if (sourceLog.state !== 'FAILED') {
    throw createError(409, 'Only failed status emails can be resent');
  }

  const order = await getOrderForStatusEmail(orderId);

  if (!order) {
    throw createError(404, 'Order not found');
  }

  const result = await sendOrderStatusEmailWithLog({
    order,
    adminId,
    statusSnapshot: sourceLog.statusSnapshot || order.status,
    note,
    source: 'ADMIN_RESEND_STATUS_EMAIL',
    resendOfLogId: sourceLog.id,
  });

  return res.status(200).json({
    sent: result.sent,
    message: result.sent
      ? 'Status email resent successfully.'
      : 'Status email resend failed. Failure has been logged.',
    emailLog: formatOrderStatusEmailLog(result.emailLog),
  });
};

const getDashboard = async (req, res) => {
  const todayStart = startOfUtcDay(new Date());
  const todayEnd = endOfUtcDay(new Date());
  const seriesStart = addDaysUtc(todayStart, -6);

  const [
    todayRevenueAggregate,
    todayOrders,
    pendingOrders,
    paidOrdersForSeries,
    statusGroups,
    lowStockCount,
    topSellingVariant,
    recentOrders,
    recentShipments,
    recentPayments,
    lowStockVariants,
  ] = await prisma.$transaction([
    prisma.order.aggregate({
      where: {
        deletedAt: null,
        createdAt: { gte: todayStart, lte: todayEnd },
        paymentStatus: 'SUCCESS',
      },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({
      where: {
        deletedAt: null,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.order.count({
      where: {
        deletedAt: null,
        status: 'PENDING',
      },
    }),
    prisma.order.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: seriesStart, lte: todayEnd },
        paymentStatus: 'SUCCESS',
      },
      select: {
        createdAt: true,
        totalAmount: true,
      },
    }),
    prisma.order.groupBy({
      by: ['status'],
      where: {
        deletedAt: null,
      },
      _count: { status: true },
    }),
    prisma.inventory.count({
      where: {
        quantity: { lte: 5 },
      },
    }),
    prisma.orderItem.groupBy({
      by: ['variantId'],
      where: {
        order: {
          deletedAt: null,
        },
      },
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: 1,
    }),
    prisma.order.findMany({
      where: {
        deletedAt: null,
      },
      take: 8,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            fullName: true,
          },
        },
        orderAddress: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.orderShipment.findMany({
      where: {
        deletedAt: null,
        order: {
          deletedAt: null,
        },
      },
      take: 8,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        deletedAt: null,
        status: 'SUCCESS',
      },
      take: 8,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
      },
    }),
    prisma.productVariant.findMany({
      where: {
        inventory: {
          quantity: { lte: 5 },
        },
      },
      take: 8,
      include: {
        inventory: true,
        product: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    }),
  ]
);

  const statusBreakdown = ORDER_STATUSES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});

  statusGroups.forEach((group) => {
    statusBreakdown[group.status] = group._count.status;
  });

  const revenueByDate = {};
  for (let i = 0; i < 7; i += 1) {
    const day = addDaysUtc(seriesStart, i);
    revenueByDate[toDateOnly(day)] = 0;
  }

  paidOrdersForSeries.forEach((order) => {
    const key = toDateOnly(order.createdAt);
    if (!(key in revenueByDate)) {
      revenueByDate[key] = 0;
    }
    revenueByDate[key] += toNumber(order.totalAmount) || 0;
  });

  const revenueTimeseries = Object.entries(revenueByDate).map(([date, revenue]) => ({
    date,
    revenue: Number(revenue.toFixed(2)),
  }));

  let topProduct = null;
  if (topSellingVariant.length > 0) {
    const topVariantId = topSellingVariant[0].variantId;
    const variant = await prisma.productVariant.findUnique({
      where: { id: topVariantId },
      include: {
        product: {
          select: {
            name: true,
          },
        },
        images: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });

    if (variant) {
      const primaryImage = variant.images.find((image) => image.isPrimary) || variant.images[0] || null;

      topProduct = {
        name: variant.product.name,
        imageUrl: primaryImage?.url || null,
        unitsSold: topSellingVariant[0]._sum.quantity || 0,
      };
    }
  }

  const activity = [];

  recentOrders.forEach((order) => {
    const person = order.user?.fullName || order.orderAddress?.name || 'Customer';
    activity.push({
      type: 'NEW_ORDER',
      title: `New order #${order.orderNumber}`,
      description: `${INR_FORMATTER.format(toNumber(order.totalAmount) || 0)} — ${person}`,
      referenceId: order.id,
      createdAt: order.createdAt,
    });
  });

  recentShipments
    .filter((shipment) => shipment.status !== 'PENDING')
    .forEach((shipment) => {
      activity.push({
        type: 'STATUS_CHANGE',
        title: `Order #${shipment.order.orderNumber} ${shipment.status.toLowerCase()}`,
        referenceId: shipment.order.id,
        createdAt: shipment.createdAt,
      });
    });

  lowStockVariants.forEach((variant) => {
    activity.push({
      type: 'LOW_STOCK',
      title: `${variant.product.name} — only ${variant.inventory?.quantity || 0} left`,
      referenceId: variant.productId,
      createdAt: variant.updatedAt,
    });
  });

  recentPayments.forEach((payment) => {
    activity.push({
      type: 'PAYMENT',
      title: `Payment received for #${payment.order.orderNumber}`,
      description: `${INR_FORMATTER.format(toNumber(payment.amount) || 0)} via ${payment.gateway}`,
      referenceId: payment.order.id,
      createdAt: payment.paidAt || payment.createdAt,
    });
  });

  const activityFeed = activity
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20)
    .map((entry) => ({
      ...entry,
      createdAt: new Date(entry.createdAt).toISOString(),
    }));

  return res.status(200).json({
    todayRevenue: Number((toNumber(todayRevenueAggregate._sum.totalAmount) || 0).toFixed(2)),
    todayOrders,
    pendingOrders,
    revenueTimeseries,
    statusBreakdown,
    lowStockCount,
    topProduct,
    activityFeed,
  });
};

const listOrders = async (req, res) => {
  const { skip, take } = parsePagination(req.query, 20, 100);

  const status = ensureEnumValue(req.query.status, ORDER_STATUSES, 'status');
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const includeDeleted = parseBool(req.query.includeDeleted) === true;

  const where = {
    ...(includeDeleted ? {} : { deletedAt: null }),
    ...(status ? { status } : {}),
    ...(search
      ? {
        OR: [
          {
            orderNumber: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            user: {
              email: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
          {
            orderAddress: {
              email: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        ],
      }
      : {}),
  };

  const [total, orders] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        orderAddress: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        items: {
          select: {
            quantity: true,
          },
        },
        shipments: {
          ...(includeDeleted ? {} : { where: { deletedAt: null } }),
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    }),
  ]);

  return res.status(200).json({
    orders: orders.map(formatOrderSummary),
    pagination: buildPagination(total, skip, take),
  });
};

const getOrderById = async (req, res) => {
  const { orderId } = req.params;
  const includeDeleted = parseBool(req.query.includeDeleted) === true;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
        },
      },
      items: {
        include: {
          variant: {
            include: {
              images: {
                orderBy: {
                  position: 'asc',
                },
              },
            },
          },
        },
      },
      orderAddress: true,
      shipments: {
        ...(includeDeleted ? {} : { where: { deletedAt: null } }),
        orderBy: {
          createdAt: 'desc',
        },
      },
      payments: {
        ...(includeDeleted ? {} : { where: { deletedAt: null } }),
        orderBy: {
          createdAt: 'asc',
        },
      },
      statusEmailLogs: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 30,
        include: {
          admin: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!order || (!includeDeleted && order.deletedAt)) {
    throw createError(404, 'Order not found');
  }

  return res.status(200).json(formatFullOrder(order));
};

const updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const status = ensureEnumValue(req.body?.status, ORDER_STATUSES, 'status');
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : undefined;
  const { adminId } = getAdminActor(req);
  let previousStatus;

  if (!status) {
    throw createError(400, 'status is required');
  }

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        deletedAt: true,
        items: {
          select: {
            variantId: true,
            quantity: true,
          },
        },
      },
    });

    if (!order) {
      throw createError(404, 'Order not found');
    }
    if (order.deletedAt) {
      throw createError(409, 'Cannot update a cancelled order');
    }
    previousStatus = order.status;

    await tx.order.update({
      where: { id: orderId },
      data: {
        status,
      },
    });

    if (order.status !== status || note) {
      await createOrderLogTx(tx, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        adminId,
        action: 'STATUS_UPDATED',
        fromStatus: order.status,
        toStatus: status,
        note: note || null,
      });
    }

    if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
      await releaseReservedInventoryForOrderItemsTx(tx, {
        orderId: order.id,
        orderItems: order.items,
        note: note
          ? `Order cancelled by admin via status update. ${note}`
          : 'Order cancelled by admin via status update.',
      });
    }

    if (status === 'SHIPPED' || status === 'DELIVERED') {
      const currentShipment = await tx.orderShipment.findFirst({
        where: {
          orderId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      const shipmentStatus = status === 'SHIPPED' ? 'SHIPPED' : 'DELIVERED';

      let savedShipment;
      if (currentShipment) {
        savedShipment = await tx.orderShipment.update({
          where: { id: currentShipment.id },
          data: {
            status: shipmentStatus,
            ...(status === 'SHIPPED' && !currentShipment.shippedAt ? { shippedAt: new Date() } : {}),
          },
        });
      } else {
        savedShipment = await tx.orderShipment.create({
          data: {
            orderId,
            status: shipmentStatus,
            shippedAt: status === 'SHIPPED' ? new Date() : null,
          },
        });
      }

      if (!currentShipment || currentShipment.status !== shipmentStatus || note) {
        await createShipmentLogTx(tx, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          shipmentId: savedShipment.id,
          adminId,
          action: currentShipment ? 'STATUS_SYNC_FROM_ORDER' : 'CREATED_FROM_ORDER_STATUS',
          fromStatus: currentShipment?.status,
          toStatus: shipmentStatus,
          courierName: savedShipment.courierName,
          trackingNumber: savedShipment.trackingNumber,
          trackingUrl: savedShipment.trackingUrl,
          note: note || null,
        });
      }
    }
  });

  const updatedOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
        },
      },
      orderAddress: {
        select: {
          name: true,
          email: true,
          phone: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
        },
      },
      items: {
        select: {
          productName: true,
          color: true,
          size: true,
          price: true,
          subtotal: true,
          quantity: true,
        },
      },
      shipments: {
        where: {
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  if (!updatedOrder) {
    throw createError(404, 'Order not found');
  }

  if (previousStatus !== status) {
    await sendOrderStatusUpdateEmail(updatedOrder, { status, note });
  }

  return res.status(200).json({
    message: 'Order status updated successfully',
    order: formatOrderSummary(updatedOrder),
  });
};

const updateOrderPaymentStatus = async (req, res) => {
  const { orderId } = req.params;
  const paymentStatus = ensureEnumValue(req.body?.paymentStatus, PAYMENT_STATUSES, 'paymentStatus');
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : undefined;
  const { adminId } = getAdminActor(req);

  if (!paymentStatus) {
    throw createError(400, 'paymentStatus is required');
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        razorpayOrderId: true,
        razorpayPaymentId: true,
        totalAmount: true,
        deletedAt: true,
        payments: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            id: true,
            gateway: true,
            gatewayOrderId: true,
            gatewayPaymentId: true,
            externalReference: true,
            amount: true,
            status: true,
            paidAt: true,
            note: true,
          },
        },
      },
    });

    if (!order) {
      throw createError(404, 'Order not found');
    }
    if (order.deletedAt) {
      throw createError(409, 'Cannot update payment status for a cancelled order');
    }

    const latestPayment = order.payments?.[0] || null;
    let touchedPayment;

    if (latestPayment) {
      const resolvedGatewayOrderId = latestPayment.gatewayOrderId
        || (latestPayment.gateway === 'RAZORPAY' ? order.razorpayOrderId || null : null);
      const resolvedGatewayPaymentId = latestPayment.gatewayPaymentId
        || (latestPayment.gateway === 'RAZORPAY' ? order.razorpayPaymentId || null : null);

      assertPaymentReferences({
        gateway: latestPayment.gateway,
        status: paymentStatus,
        gatewayOrderId: resolvedGatewayOrderId,
        gatewayPaymentId: resolvedGatewayPaymentId,
        externalReference: latestPayment.externalReference || null,
        context: 'order payment status update',
      });

      touchedPayment = await tx.payment.update({
        where: { id: latestPayment.id },
        data: {
          status: paymentStatus,
          gatewayOrderId: resolvedGatewayOrderId,
          gatewayPaymentId: resolvedGatewayPaymentId,
          paidAt: paymentStatus === 'SUCCESS'
            ? (latestPayment.paidAt || new Date())
            : null,
          ...(note !== undefined ? { note: note || null } : {}),
        },
      });

      if (latestPayment.status !== touchedPayment.status || note) {
        await createPaymentLogTx(tx, {
          paymentId: touchedPayment.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          adminId,
          action: 'STATUS_UPDATED',
          fromStatus: latestPayment.status,
          toStatus: touchedPayment.status,
          amount: touchedPayment.amount,
          note: note || null,
          metadata: {
            source: 'ORDER_PAYMENT_STATUS_ENDPOINT',
          },
        });
      }
    } else {
      const resolvedGatewayOrderId = order.paymentMethod === 'RAZORPAY'
        ? order.razorpayOrderId || null
        : null;
      const resolvedGatewayPaymentId = order.paymentMethod === 'RAZORPAY'
        ? order.razorpayPaymentId || null
        : null;

      assertPaymentReferences({
        gateway: order.paymentMethod,
        status: paymentStatus,
        gatewayOrderId: resolvedGatewayOrderId,
        gatewayPaymentId: resolvedGatewayPaymentId,
        externalReference: null,
        context: 'order payment status update',
      });

      touchedPayment = await tx.payment.create({
        data: {
          orderId: order.id,
          gateway: order.paymentMethod,
          gatewayOrderId: resolvedGatewayOrderId,
          gatewayPaymentId: resolvedGatewayPaymentId,
          amount: order.totalAmount,
          status: paymentStatus,
          paidAt: paymentStatus === 'SUCCESS' ? new Date() : null,
          idempotencyKey: `admin-order-payment-status-${randomUUID()}`,
          ...(note !== undefined ? { note: note || null } : {}),
        },
      });

      await createPaymentLogTx(tx, {
        paymentId: touchedPayment.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        adminId,
        action: 'CREATED',
        toStatus: touchedPayment.status,
        amount: touchedPayment.amount,
        note: note || null,
        metadata: {
          source: 'ORDER_PAYMENT_STATUS_ENDPOINT',
        },
      });
    }

    const syncResult = await syncOrderPaymentStateTx(tx, order.id);

    if (
      order.paymentStatus !== syncResult.toPaymentStatus
      || order.status !== syncResult.toStatus
      || note
    ) {
      await createOrderLogTx(tx, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        adminId,
        action: 'PAYMENT_STATUS_UPDATED',
        fromStatus: syncResult.fromStatus,
        toStatus: syncResult.toStatus,
        fromPaymentStatus: syncResult.fromPaymentStatus,
        toPaymentStatus: syncResult.toPaymentStatus,
        note: note || null,
        metadata: {
          requestedPaymentStatus: paymentStatus,
          paymentId: touchedPayment.id,
          source: 'ORDER_PAYMENT_STATUS_ENDPOINT',
        },
      });
    }

    return tx.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        orderAddress: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        items: {
          select: {
            quantity: true,
          },
        },
        shipments: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });
  });

  if (!updatedOrder) {
    throw createError(500, 'Order could not be loaded after payment status update');
  }

  return res.status(200).json({
    message: 'Order payment status updated successfully',
    order: formatOrderSummary(updatedOrder),
  });
};

const updateOrderShipment = async (req, res) => {
  const { orderId } = req.params;
  const shipmentStatus = ensureEnumValue(req.body?.status, SHIPMENT_STATUSES, 'status');
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : undefined;
  const { adminId } = getAdminActor(req);
  const parsedShippedAt = req.body?.shippedAt !== undefined
    ? (req.body.shippedAt ? new Date(req.body.shippedAt) : null)
    : undefined;

  if (parsedShippedAt && Number.isNaN(parsedShippedAt.getTime())) {
    throw createError(400, 'shippedAt must be a valid date');
  }

  const payload = {
    ...(req.body.courierName !== undefined ? { courierName: req.body.courierName || null } : {}),
    ...(req.body.trackingNumber !== undefined ? { trackingNumber: req.body.trackingNumber || null } : {}),
    ...(req.body.trackingUrl !== undefined ? { trackingUrl: req.body.trackingUrl || null } : {}),
    ...(shipmentStatus ? { status: shipmentStatus } : {}),
    ...(parsedShippedAt !== undefined ? { shippedAt: parsedShippedAt } : {}),
  };

  if (Object.keys(payload).length === 0 && !note) {
    throw createError(400, 'No shipment fields provided to update');
  }

  const shipment = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!order) {
      throw createError(404, 'Order not found');
    }
    if (order.deletedAt) {
      throw createError(409, 'Cannot update shipment for a cancelled order');
    }

    const existingShipment = await tx.orderShipment.findFirst({
      where: {
        orderId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    const shouldSetShippedAt = shipmentStatus === 'SHIPPED' || shipmentStatus === 'DELIVERED';

    let savedShipment;
    if (existingShipment) {
      savedShipment = await tx.orderShipment.update({
        where: { id: existingShipment.id },
        data: {
          ...payload,
          ...(parsedShippedAt === undefined && shouldSetShippedAt && !existingShipment.shippedAt
            ? { shippedAt: new Date() }
            : {}),
        },
      });
    } else {
      savedShipment = await tx.orderShipment.create({
        data: {
          orderId,
          ...payload,
          ...(parsedShippedAt === undefined && shouldSetShippedAt ? { shippedAt: new Date() } : {}),
        },
      });
    }

    const nextOrderStatus = shipmentStatus === 'SHIPPED'
      ? 'SHIPPED'
      : shipmentStatus === 'DELIVERED'
        ? 'DELIVERED'
        : order.status;

    if (nextOrderStatus !== order.status) {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: nextOrderStatus,
        },
      });

      await createOrderLogTx(tx, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        adminId,
        action: 'STATUS_SYNCED_FROM_SHIPMENT',
        fromStatus: order.status,
        toStatus: nextOrderStatus,
        note: note || null,
      });
    }

    await createShipmentLogTx(tx, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      shipmentId: savedShipment.id,
      adminId,
      action: existingShipment ? 'UPDATED' : 'CREATED',
      fromStatus: existingShipment?.status,
      toStatus: savedShipment.status,
      courierName: savedShipment.courierName,
      trackingNumber: savedShipment.trackingNumber,
      trackingUrl: savedShipment.trackingUrl,
      note: note || null,
      metadata: existingShipment
        ? {
          updatedFields: Object.keys(payload),
        }
        : null,
    });

    return savedShipment;
  });

  return res.status(200).json({
    message: 'Shipment updated successfully',
    shipment: formatShipment(shipment),
  });
};

const deleteOrder = async (req, res) => {
  const { orderId } = req.params;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : undefined;
  const { adminId } = getAdminActor(req);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        select: {
          id: true,
          quantity: true,
          variantId: true,
          productName: true,
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
        },
      },
      orderAddress: true,
      shipments: {
        where: {
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  if (!order) {
    throw createError(404, 'Order not found');
  }
  if (order.deletedAt) {
    throw createError(409, 'Order has already been cancelled');
  }

  const softDeletedOrder = await prisma.$transaction(async (tx) => {
    const releaseResult = await releaseReservedInventoryForOrderItemsTx(tx, {
      orderId: order.id,
      orderItems: order.items,
      note: reason
        ? `Order cancelled by admin. ${reason}`
        : 'Order cancelled by admin.',
    });

    const activeShipments = await tx.orderShipment.findMany({
      where: {
        orderId: order.id,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        courierName: true,
        trackingNumber: true,
        trackingUrl: true,
      },
    });

    if (activeShipments.length > 0) {
      for (const shipment of activeShipments) {
        await createShipmentLogTx(tx, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          shipmentId: shipment.id,
          adminId,
          action: 'VOIDED_BY_ORDER_CANCELLATION',
          fromStatus: shipment.status,
          toStatus: shipment.status,
          courierName: shipment.courierName,
          trackingNumber: shipment.trackingNumber,
          trackingUrl: shipment.trackingUrl,
          note: reason || null,
        });
      }

      await tx.orderShipment.updateMany({
        where: {
          orderId: order.id,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
          deleteReason: reason || null,
          deletedBy: adminId,
        },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        deletedAt: new Date(),
        deleteReason: reason || null,
        deletedBy: adminId,
      },
    });

    await createOrderLogTx(tx, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      adminId,
      action: 'CANCELLED',
      fromStatus: order.status,
      toStatus: 'CANCELLED',
      fromPaymentStatus: order.paymentStatus,
      toPaymentStatus: order.paymentStatus,
      note: reason || null,
      metadata: {
        totalAmount: toNumber(order.totalAmount),
        itemsCount: (order.items || []).reduce((acc, item) => acc + item.quantity, 0),
        cancelledShipmentCount: activeShipments.length,
        releasedInventoryQuantity: releaseResult.releasedQuantity,
        releasedInventoryVariantCount: releaseResult.releasedVariantCount,
      },
    });

    return tx.order.findUnique({
      where: { id: order.id },
      include: {
        items: {
          select: {
            quantity: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        orderAddress: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        shipments: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });
  });

  if (!softDeletedOrder) {
    throw createError(500, 'Order could not be loaded after cancellation');
  }

  return res.status(200).json({
    message: 'Order cancelled successfully',
    order: {
      ...formatOrderSummary(softDeletedOrder),
      reason: reason || null,
    },
  });
};

const listOrderLogs = async (req, res) => {
  const { skip, take } = parsePagination(req.query, 30, 200);
  const orderId = req.params.orderId || (typeof req.query.orderId === 'string' ? req.query.orderId.trim() : undefined);
  const action = typeof req.query.action === 'string' ? req.query.action.trim().toUpperCase() : undefined;
  const adminId = typeof req.query.adminId === 'string' ? req.query.adminId.trim() : undefined;
  const status = ensureEnumValue(req.query.status, ORDER_STATUSES, 'status');
  const paymentStatus = ensureEnumValue(req.query.paymentStatus, PAYMENT_STATUSES, 'paymentStatus');
  const createdAt = parseDateFilter(req.query.startDate, req.query.endDate, 'order log date range');
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const and = [];
  if (status) {
    and.push({
      OR: [{ fromStatus: status }, { toStatus: status }],
    });
  }
  if (paymentStatus) {
    and.push({
      OR: [{ fromPaymentStatus: paymentStatus }, { toPaymentStatus: paymentStatus }],
    });
  }
  if (search) {
    and.push({
      OR: [
        { note: { contains: search, mode: 'insensitive' } },
        { orderNumberSnapshot: { contains: search, mode: 'insensitive' } },
        { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
        { admin: { fullName: { contains: search, mode: 'insensitive' } } },
        { admin: { email: { contains: search, mode: 'insensitive' } } },
      ],
    });
  }

  const where = {
    ...(orderId ? { orderId } : {}),
    ...(action ? { action } : {}),
    ...(adminId ? { adminId } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(and.length ? { AND: and } : {}),
  };

  const [total, logs] = await prisma.$transaction([
    prisma.orderLog.count({ where }),
    prisma.orderLog.findMany({
      where,
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
        admin: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return res.status(200).json({
    logs: logs.map(formatOrderLog),
    pagination: buildPagination(total, skip, take),
  });
};

const listShipments = async (req, res) => {
  const { skip, take } = parsePagination(req.query, 30, 200);
  const status = ensureEnumValue(req.query.status, SHIPMENT_STATUSES, 'status');
  const orderId = typeof req.query.orderId === 'string' ? req.query.orderId.trim() : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const createdAt = parseDateFilter(req.query.startDate, req.query.endDate, 'shipment date range');
  const includeDeleted = parseBool(req.query.includeDeleted) === true;

  const where = {
    ...(includeDeleted ? {} : { deletedAt: null }),
    ...(status ? { status } : {}),
    ...(orderId ? { orderId } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(search
      ? {
        OR: [
          { trackingNumber: { contains: search, mode: 'insensitive' } },
          { courierName: { contains: search, mode: 'insensitive' } },
          { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
        ],
      }
      : {}),
  };

  const [total, shipments] = await prisma.$transaction([
    prisma.orderShipment.count({ where }),
    prisma.orderShipment.findMany({
      where,
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            deletedAt: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  return res.status(200).json({
    shipments: shipments.map((shipment) => formatShipment(shipment, true)),
    pagination: buildPagination(total, skip, take),
  });
};

const getShipmentById = async (req, res) => {
  const { shipmentId } = req.params;
  const includeDeleted = parseBool(req.query.includeDeleted) === true;

  const shipment = await prisma.orderShipment.findUnique({
    where: { id: shipmentId },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
        },
      },
      shipmentLogs: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
        include: {
          admin: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
        },
      },
    },
  });

  if (!shipment || (!includeDeleted && shipment.deletedAt)) {
    throw createError(404, 'Shipment not found');
  }

  return res.status(200).json({
    shipment: formatShipment(shipment, true),
    logs: shipment.shipmentLogs.map(formatShipmentLog),
  });
};

const createShipmentForOrder = async (req, res) => {
  const { orderId } = req.params;
  const requestedStatus = ensureEnumValue(req.body?.status, SHIPMENT_STATUSES, 'status');
  const status = requestedStatus || 'PENDING';
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : undefined;
  const { adminId } = getAdminActor(req);
  const parsedShippedAt = req.body?.shippedAt ? new Date(req.body.shippedAt) : undefined;

  if (parsedShippedAt && Number.isNaN(parsedShippedAt.getTime())) {
    throw createError(400, 'shippedAt must be a valid date');
  }

  const shipment = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!order) {
      throw createError(404, 'Order not found');
    }
    if (order.deletedAt) {
      throw createError(409, 'Cannot create shipment for a cancelled order');
    }

    const savedShipment = await tx.orderShipment.create({
      data: {
        orderId,
        courierName: req.body?.courierName || null,
        trackingNumber: req.body?.trackingNumber || null,
        trackingUrl: req.body?.trackingUrl || null,
        status,
        shippedAt: parsedShippedAt || ((status === 'SHIPPED' || status === 'DELIVERED') ? new Date() : null),
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
          },
        },
      },
    });

    await createShipmentLogTx(tx, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      shipmentId: savedShipment.id,
      adminId,
      action: 'CREATED',
      toStatus: savedShipment.status,
      courierName: savedShipment.courierName,
      trackingNumber: savedShipment.trackingNumber,
      trackingUrl: savedShipment.trackingUrl,
      note: note || null,
    });

    const nextOrderStatus = status === 'SHIPPED'
      ? 'SHIPPED'
      : status === 'DELIVERED'
        ? 'DELIVERED'
        : order.status;

    if (nextOrderStatus !== order.status) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: nextOrderStatus,
        },
      });

      await createOrderLogTx(tx, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        adminId,
        action: 'STATUS_SYNCED_FROM_SHIPMENT',
        fromStatus: order.status,
        toStatus: nextOrderStatus,
        note: note || null,
      });
    }

    return tx.orderShipment.findUnique({
      where: { id: savedShipment.id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
          },
        },
      },
    });
  });

  if (!shipment) {
    throw createError(500, 'Shipment could not be loaded after creation');
  }

  // Send shipment update email
  const fullOrder = await prisma.order.findUnique({
    where: { id: shipment.orderId },
    select: {
      id: true,
      userId: true,
      sessionId: true,
      orderNumber: true,
    },
  });
  
  if (fullOrder) {
    await sendShipmentUpdateEmail(shipment, fullOrder);
  }

  return res.status(201).json({
    message: 'Shipment created successfully',
    shipment: formatShipment(shipment, true),
  });
};

const updateShipmentById = async (req, res) => {
  const { shipmentId } = req.params;
  const shipmentStatus = ensureEnumValue(req.body?.status, SHIPMENT_STATUSES, 'status');
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : undefined;
  const { adminId } = getAdminActor(req);
  const parsedShippedAt = req.body?.shippedAt !== undefined
    ? (req.body.shippedAt ? new Date(req.body.shippedAt) : null)
    : undefined;

  if (parsedShippedAt && Number.isNaN(parsedShippedAt.getTime())) {
    throw createError(400, 'shippedAt must be a valid date');
  }

  const payload = {
    ...(req.body?.courierName !== undefined ? { courierName: req.body.courierName || null } : {}),
    ...(req.body?.trackingNumber !== undefined ? { trackingNumber: req.body.trackingNumber || null } : {}),
    ...(req.body?.trackingUrl !== undefined ? { trackingUrl: req.body.trackingUrl || null } : {}),
    ...(shipmentStatus ? { status: shipmentStatus } : {}),
    ...(parsedShippedAt !== undefined ? { shippedAt: parsedShippedAt } : {}),
  };

  if (Object.keys(payload).length === 0 && !note) {
    throw createError(400, 'No shipment fields provided to update');
  }

  const updatedShipment = await prisma.$transaction(async (tx) => {
    const existingShipment = await tx.orderShipment.findUnique({
      where: { id: shipmentId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
          },
        },
      },
    });

    if (!existingShipment) {
      throw createError(404, 'Shipment not found');
    }
    if (existingShipment.deletedAt) {
      throw createError(409, 'Shipment has been cancelled');
    }
    if (existingShipment.order.deletedAt) {
      throw createError(409, 'Cannot update shipment for a cancelled order');
    }

    const shouldSetShippedAt = shipmentStatus === 'SHIPPED' || shipmentStatus === 'DELIVERED';
    const savedShipment = await tx.orderShipment.update({
      where: { id: shipmentId },
      data: {
        ...payload,
        ...(parsedShippedAt === undefined && shouldSetShippedAt && !existingShipment.shippedAt
          ? { shippedAt: new Date() }
          : {}),
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
          },
        },
      },
    });

    const nextOrderStatus = shipmentStatus === 'SHIPPED'
      ? 'SHIPPED'
      : shipmentStatus === 'DELIVERED'
        ? 'DELIVERED'
        : existingShipment.order.status;

    if (nextOrderStatus !== existingShipment.order.status) {
      await tx.order.update({
        where: { id: existingShipment.order.id },
        data: {
          status: nextOrderStatus,
        },
      });

      await createOrderLogTx(tx, {
        orderId: existingShipment.order.id,
        orderNumber: existingShipment.order.orderNumber,
        adminId,
        action: 'STATUS_SYNCED_FROM_SHIPMENT',
        fromStatus: existingShipment.order.status,
        toStatus: nextOrderStatus,
        note: note || null,
      });
    }

    await createShipmentLogTx(tx, {
      orderId: existingShipment.order.id,
      orderNumber: existingShipment.order.orderNumber,
      shipmentId: savedShipment.id,
      adminId,
      action: existingShipment.status !== savedShipment.status ? 'STATUS_UPDATED' : 'UPDATED',
      fromStatus: existingShipment.status,
      toStatus: savedShipment.status,
      courierName: savedShipment.courierName,
      trackingNumber: savedShipment.trackingNumber,
      trackingUrl: savedShipment.trackingUrl,
      note: note || null,
      metadata: {
        updatedFields: Object.keys(payload),
      },
    });

    return tx.orderShipment.findUnique({
      where: { id: savedShipment.id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
          },
        },
      },
    });
  });

  if (!updatedShipment) {
    throw createError(500, 'Shipment could not be loaded after update');
  }

  // Send shipment update email
  const fullOrder = await prisma.order.findUnique({
    where: { id: updatedShipment.orderId },
    select: {
      id: true,
      userId: true,
      sessionId: true,
      orderNumber: true,
    },
  });
  
  if (fullOrder) {
    await sendShipmentUpdateEmail(updatedShipment, fullOrder);
  }

  return res.status(200).json({
    message: 'Shipment updated successfully',
    shipment: formatShipment(updatedShipment, true),
  });
};

const deleteShipmentById = async (req, res) => {
  const { shipmentId } = req.params;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : undefined;
  const { adminId } = getAdminActor(req);

  const deletedShipment = await prisma.$transaction(async (tx) => {
    const shipment = await tx.orderShipment.findUnique({
      where: { id: shipmentId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
          },
        },
      },
    });

    if (!shipment) {
      throw createError(404, 'Shipment not found');
    }
    if (shipment.deletedAt) {
      throw createError(409, 'Shipment has already been cancelled');
    }

    await createShipmentLogTx(tx, {
      orderId: shipment.order.id,
      orderNumber: shipment.order.orderNumber,
      shipmentId: shipment.id,
      adminId,
      action: 'VOIDED',
      fromStatus: shipment.status,
      toStatus: shipment.status,
      courierName: shipment.courierName,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      note: reason || null,
    });

    await tx.orderShipment.update({
      where: { id: shipment.id },
      data: {
        deletedAt: new Date(),
        deleteReason: reason || null,
        deletedBy: adminId,
      },
    });

    const latestActiveShipment = await tx.orderShipment.findFirst({
      where: {
        orderId: shipment.order.id,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        status: true,
      },
    });

    const inferredOrderStatus = latestActiveShipment?.status === 'DELIVERED'
      ? 'DELIVERED'
      : latestActiveShipment?.status === 'SHIPPED'
        ? 'SHIPPED'
        : (shipment.order.status === 'DELIVERED' || shipment.order.status === 'SHIPPED')
          ? 'PENDING'
          : shipment.order.status;

    if (inferredOrderStatus !== shipment.order.status) {
      await tx.order.update({
        where: { id: shipment.order.id },
        data: {
          status: inferredOrderStatus,
        },
      });
    }

    await createOrderLogTx(tx, {
      orderId: shipment.order.id,
      orderNumber: shipment.order.orderNumber,
      adminId,
      action: 'SHIPMENT_VOIDED',
      fromStatus: shipment.order.status,
      toStatus: inferredOrderStatus,
      fromPaymentStatus: shipment.order.paymentStatus,
      toPaymentStatus: shipment.order.paymentStatus,
      note: reason || null,
      metadata: {
        shipmentId: shipment.id,
        shipmentStatus: shipment.status,
        previousOrderStatus: shipment.order.status,
        inferredOrderStatus,
      },
    });

    return tx.orderShipment.findUnique({
      where: { id: shipment.id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
          },
        },
      },
    });
  });

  if (!deletedShipment) {
    throw createError(500, 'Shipment could not be loaded after cancellation');
  }

  return res.status(200).json({
    message: 'Shipment cancelled successfully',
    shipment: formatShipment(deletedShipment, true),
  });
};

const listShipmentLogs = async (req, res) => {
  const { skip, take } = parsePagination(req.query, 30, 200);
  const shipmentId = req.params.shipmentId || (typeof req.query.shipmentId === 'string' ? req.query.shipmentId.trim() : undefined);
  const orderId = typeof req.query.orderId === 'string' ? req.query.orderId.trim() : undefined;
  const adminId = typeof req.query.adminId === 'string' ? req.query.adminId.trim() : undefined;
  const action = typeof req.query.action === 'string' ? req.query.action.trim().toUpperCase() : undefined;
  const status = ensureEnumValue(req.query.status, SHIPMENT_STATUSES, 'status');
  const createdAt = parseDateFilter(req.query.startDate, req.query.endDate, 'shipment log date range');
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const and = [];
  if (status) {
    and.push({
      OR: [{ fromStatus: status }, { toStatus: status }],
    });
  }
  if (search) {
    and.push({
      OR: [
        { note: { contains: search, mode: 'insensitive' } },
        { orderNumberSnapshot: { contains: search, mode: 'insensitive' } },
        { trackingNumber: { contains: search, mode: 'insensitive' } },
        { courierName: { contains: search, mode: 'insensitive' } },
        { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
        { admin: { fullName: { contains: search, mode: 'insensitive' } } },
        { admin: { email: { contains: search, mode: 'insensitive' } } },
      ],
    });
  }

  const where = {
    ...(shipmentId ? { shipmentId } : {}),
    ...(orderId ? { orderId } : {}),
    ...(adminId ? { adminId } : {}),
    ...(action ? { action } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(and.length ? { AND: and } : {}),
  };

  const [total, logs] = await prisma.$transaction([
    prisma.shipmentLog.count({ where }),
    prisma.shipmentLog.findMany({
      where,
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        shipment: {
          select: {
            id: true,
            status: true,
            trackingNumber: true,
            trackingUrl: true,
            courierName: true,
            shippedAt: true,
            createdAt: true,
            orderId: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
        admin: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return res.status(200).json({
    logs: logs.map((log) => ({
      ...formatShipmentLog(log),
      shipment: log.shipment ? formatShipment(log.shipment) : null,
    })),
    pagination: buildPagination(total, skip, take),
  });
};

const listPayments = async (req, res) => {
  const { skip, take } = parsePagination(req.query, 30, 200);
  const status = ensureEnumValue(req.query.status, PAYMENT_STATUSES, 'status');
  const gateway = ensureEnumValue(req.query.gateway, PAYMENT_GATEWAYS, 'gateway');
  const orderId = typeof req.query.orderId === 'string' ? req.query.orderId.trim() : undefined;
  const createdAt = parseDateFilter(req.query.startDate, req.query.endDate, 'payment date range');
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const includeDeleted = parseBool(req.query.includeDeleted) === true;

  const where = {
    ...(includeDeleted ? {} : { deletedAt: null }),
    ...(status ? { status } : {}),
    ...(gateway ? { gateway } : {}),
    ...(orderId ? { orderId } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(search
      ? {
        OR: [
          { gatewayOrderId: { contains: search, mode: 'insensitive' } },
          { gatewayPaymentId: { contains: search, mode: 'insensitive' } },
          { externalReference: { contains: search, mode: 'insensitive' } },
          { note: { contains: search, mode: 'insensitive' } },
          { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
          { order: { user: { email: { contains: search, mode: 'insensitive' } } } },
          { order: { orderAddress: { email: { contains: search, mode: 'insensitive' } } } },
        ],
      }
      : {}),
  };

  const [total, payments] = await prisma.$transaction([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        order: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
            orderAddress: {
              select: {
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return res.status(200).json({
    payments: payments.map((payment) => formatPayment(payment, true)),
    pagination: buildPagination(total, skip, take),
  });
};

const getPaymentById = async (req, res) => {
  const { paymentId } = req.params;
  const includeDeleted = parseBool(req.query.includeDeleted) === true;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
            },
          },
          orderAddress: {
            select: {
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      paymentLogs: {
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          admin: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
        },
      },
    },
  });

  if (!payment || (!includeDeleted && payment.deletedAt)) {
    throw createError(404, 'Payment not found');
  }

  return res.status(200).json({
    payment: formatPayment(payment, true),
    logs: payment.paymentLogs.map(formatPaymentLog),
  });
};

const createPaymentForOrder = async (req, res) => {
  const { orderId } = req.params;
  const gateway = ensureEnumValue(req.body?.gateway, PAYMENT_GATEWAYS, 'gateway');
  const status = ensureEnumValue(req.body?.status, PAYMENT_STATUSES, 'status') || 'SUCCESS';
  const amount = parseNumber(req.body?.amount, NaN);
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : undefined;
  const metadata = parseJsonInput(req.body?.metadata, 'metadata');
  const paidAt = parseDateTimeInput(req.body?.paidAt, 'paidAt');
  const externalReferenceInput = parseNullableTextInput(req.body?.externalReference);
  const gatewayOrderIdInput = parseNullableTextInput(req.body?.gatewayOrderId);
  const gatewayPaymentIdInput = parseNullableTextInput(req.body?.gatewayPaymentId);
  const idempotencyKey = parseIdempotencyKey(req);
  const { adminId } = getAdminActor(req);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createError(400, 'amount must be greater than 0');
  }
  if (!idempotencyKey) {
    throw createError(400, 'idempotencyKey is required (body.idempotencyKey or Idempotency-Key header)');
  }
  if (idempotencyKey.length > 128) {
    throw createError(400, 'idempotencyKey must be 128 characters or fewer');
  }

  let replayedFromIdempotency = false;
  let createdPayment;

  try {
    createdPayment = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          razorpayOrderId: true,
          razorpayPaymentId: true,
          deletedAt: true,
        },
      });

      if (!order) {
        throw createError(404, 'Order not found');
      }
      if (order.deletedAt) {
        throw createError(409, 'Cannot create payment for a cancelled order');
      }

      const resolvedGateway = gateway || order.paymentMethod;
      const resolvedGatewayOrderId = gatewayOrderIdInput !== undefined
        ? gatewayOrderIdInput
        : (resolvedGateway === 'RAZORPAY' ? order.razorpayOrderId || null : null);
      const resolvedGatewayPaymentId = gatewayPaymentIdInput !== undefined
        ? gatewayPaymentIdInput
        : (resolvedGateway === 'RAZORPAY' ? order.razorpayPaymentId || null : null);
      const resolvedExternalReference = externalReferenceInput !== undefined
        ? externalReferenceInput
        : null;

      assertPaymentReferences({
        gateway: resolvedGateway,
        status,
        gatewayOrderId: resolvedGatewayOrderId,
        gatewayPaymentId: resolvedGatewayPaymentId,
        externalReference: resolvedExternalReference,
        context: 'create payment',
      });

      const existingByIdempotency = await tx.payment.findFirst({
        where: {
          orderId: order.id,
          idempotencyKey,
          deletedAt: null,
        },
      });

      if (existingByIdempotency) {
        assertIdempotentPaymentPayload(existingByIdempotency, {
          gateway: resolvedGateway,
          gatewayOrderId: resolvedGatewayOrderId,
          gatewayPaymentId: resolvedGatewayPaymentId,
          externalReference: resolvedExternalReference,
          amount,
          status,
        });

        replayedFromIdempotency = true;
        await syncOrderPaymentStateTx(tx, order.id);

        return tx.payment.findUnique({
          where: { id: existingByIdempotency.id },
          include: {
            order: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    phone: true,
                  },
                },
                orderAddress: {
                  select: {
                    name: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        });
      }

      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          gateway: resolvedGateway,
          gatewayOrderId: resolvedGatewayOrderId,
          gatewayPaymentId: resolvedGatewayPaymentId,
          externalReference: resolvedExternalReference,
          idempotencyKey,
          amount,
          status,
          paidAt: paidAt !== undefined ? paidAt : (status === 'SUCCESS' ? new Date() : null),
          ...(note !== undefined ? { note } : {}),
          ...(metadata !== undefined ? { metadata } : {}),
        },
      });

      const syncResult = await syncOrderPaymentStateTx(tx, order.id);

      await createPaymentLogTx(tx, {
        paymentId: payment.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        adminId,
        action: 'CREATED',
        toStatus: payment.status,
        amount: payment.amount,
        note: note || null,
        metadata: {
          gateway: payment.gateway,
          gatewayOrderId: payment.gatewayOrderId,
          gatewayPaymentId: payment.gatewayPaymentId,
          externalReference: payment.externalReference,
          idempotencyKey: payment.idempotencyKey,
        },
      });

      await createOrderLogTx(tx, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        adminId,
        action: 'PAYMENT_RECORDED',
        fromStatus: syncResult.fromStatus,
        toStatus: syncResult.toStatus,
        fromPaymentStatus: syncResult.fromPaymentStatus,
        toPaymentStatus: syncResult.toPaymentStatus,
        note: note || null,
        metadata: {
          paymentId: payment.id,
          paymentStatus: payment.status,
          gateway: payment.gateway,
          amount: toNumber(payment.amount),
          idempotencyKey: payment.idempotencyKey,
        },
      });

      return tx.payment.findUnique({
        where: { id: payment.id },
        include: {
          order: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  phone: true,
                },
              },
              orderAddress: {
                select: {
                  name: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      });
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw createError(409, 'Duplicate payment reference or idempotency key detected');
    }
    throw error;
  }

  if (!createdPayment) {
    throw createError(500, 'Payment could not be loaded after creation');
  }

  return res.status(replayedFromIdempotency ? 200 : 201).json({
    message: replayedFromIdempotency
      ? 'Idempotency key replayed; returning existing payment'
      : 'Payment created successfully',
    payment: formatPayment(createdPayment, true),
  });
};

const updatePaymentById = async (req, res) => {
  const { paymentId } = req.params;
  const status = ensureEnumValue(req.body?.status, PAYMENT_STATUSES, 'status');
  const gateway = ensureEnumValue(req.body?.gateway, PAYMENT_GATEWAYS, 'gateway');
  const amount = req.body?.amount !== undefined ? parseNumber(req.body.amount, NaN) : undefined;
  const paidAt = parseDateTimeInput(req.body?.paidAt, 'paidAt');
  const note = req.body?.note !== undefined ? parseNullableTextInput(req.body.note) : undefined;
  const metadata = parseJsonInput(req.body?.metadata, 'metadata');
  const externalReference = parseNullableTextInput(req.body?.externalReference);
  const gatewayOrderId = parseNullableTextInput(req.body?.gatewayOrderId);
  const gatewayPaymentId = parseNullableTextInput(req.body?.gatewayPaymentId);
  const { adminId } = getAdminActor(req);

  if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
    throw createError(400, 'amount must be greater than 0');
  }

  const data = {
    ...(status ? { status } : {}),
    ...(gateway ? { gateway } : {}),
    ...(amount !== undefined ? { amount } : {}),
    ...(externalReference !== undefined ? { externalReference } : {}),
    ...(gatewayOrderId !== undefined ? { gatewayOrderId } : {}),
    ...(gatewayPaymentId !== undefined ? { gatewayPaymentId } : {}),
    ...(note !== undefined ? { note } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
    ...(paidAt !== undefined ? { paidAt } : {}),
  };

  if (status && paidAt === undefined) {
    if (status === 'SUCCESS') {
      data.paidAt = new Date();
    } else {
      data.paidAt = null;
    }
  }

  if (Object.keys(data).length === 0) {
    throw createError(400, 'No valid payment fields provided to update');
  }

  let updatedPayment;

  try {
    updatedPayment = await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              paymentStatus: true,
              deletedAt: true,
            },
          },
        },
      });

      if (!existing) {
        throw createError(404, 'Payment not found');
      }
      if (existing.deletedAt) {
        throw createError(409, 'Payment has been voided');
      }
      if (existing.order.deletedAt) {
        throw createError(409, 'Cannot update payment for a cancelled order');
      }

      const nextGateway = gateway || existing.gateway;
      const nextStatus = status || existing.status;
      const nextGatewayOrderId = gatewayOrderId !== undefined ? gatewayOrderId : existing.gatewayOrderId;
      const nextGatewayPaymentId = gatewayPaymentId !== undefined ? gatewayPaymentId : existing.gatewayPaymentId;
      const nextExternalReference = externalReference !== undefined ? externalReference : existing.externalReference;

      assertPaymentReferences({
        gateway: nextGateway,
        status: nextStatus,
        gatewayOrderId: nextGatewayOrderId,
        gatewayPaymentId: nextGatewayPaymentId,
        externalReference: nextExternalReference,
        context: 'update payment',
      });

      const payment = await tx.payment.update({
        where: { id: paymentId },
        data,
      });

      const syncResult = await syncOrderPaymentStateTx(tx, existing.order.id);

      await createPaymentLogTx(tx, {
        paymentId: payment.id,
        orderId: existing.order.id,
        orderNumber: existing.order.orderNumber,
        adminId,
        action: existing.status !== payment.status ? 'STATUS_UPDATED' : 'UPDATED',
        fromStatus: existing.status,
        toStatus: payment.status,
        amount: payment.amount,
        note: note || null,
        metadata: {
          updatedFields: Object.keys(data),
        },
      });

      await createOrderLogTx(tx, {
        orderId: existing.order.id,
        orderNumber: existing.order.orderNumber,
        adminId,
        action: 'PAYMENT_UPDATED',
        fromStatus: syncResult.fromStatus,
        toStatus: syncResult.toStatus,
        fromPaymentStatus: syncResult.fromPaymentStatus,
        toPaymentStatus: syncResult.toPaymentStatus,
        note: note || null,
        metadata: {
          paymentId: payment.id,
          paymentStatus: payment.status,
          updatedFields: Object.keys(data),
        },
      });

      return tx.payment.findUnique({
        where: { id: payment.id },
        include: {
          order: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  phone: true,
                },
              },
              orderAddress: {
                select: {
                  name: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      });
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw createError(409, 'Duplicate payment reference detected');
    }
    throw error;
  }

  if (!updatedPayment) {
    throw createError(500, 'Payment could not be loaded after update');
  }

  return res.status(200).json({
    message: 'Payment updated successfully',
    payment: formatPayment(updatedPayment, true),
  });
};

const deletePaymentById = async (req, res) => {
  const { paymentId } = req.params;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : undefined;
  const { adminId } = getAdminActor(req);

  const deletedPayment = await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
            orderAddress: {
              select: {
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw createError(404, 'Payment not found');
    }
    if (existing.deletedAt) {
      throw createError(409, 'Payment has already been voided');
    }

    await createPaymentLogTx(tx, {
      paymentId: existing.id,
      orderId: existing.order.id,
      orderNumber: existing.order.orderNumber,
      adminId,
      action: 'VOIDED',
      fromStatus: existing.status,
      toStatus: existing.status,
      amount: existing.amount,
      note: reason || null,
      metadata: {
        gateway: existing.gateway,
        gatewayOrderId: existing.gatewayOrderId,
        gatewayPaymentId: existing.gatewayPaymentId,
        externalReference: existing.externalReference,
      },
    });

    await tx.payment.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
        deleteReason: reason || null,
        deletedBy: adminId,
      },
    });

    const syncResult = await syncOrderPaymentStateTx(tx, existing.order.id);

    await createOrderLogTx(tx, {
      orderId: existing.order.id,
      orderNumber: existing.order.orderNumber,
      adminId,
      action: 'PAYMENT_VOIDED',
      fromStatus: syncResult.fromStatus,
      toStatus: syncResult.toStatus,
      fromPaymentStatus: syncResult.fromPaymentStatus,
      toPaymentStatus: syncResult.toPaymentStatus,
      note: reason || null,
      metadata: {
        paymentId: existing.id,
        deletedPaymentStatus: existing.status,
      },
    });

    return tx.payment.findUnique({
      where: { id: existing.id },
      include: {
        order: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
            orderAddress: {
              select: {
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });
  });

  if (!deletedPayment) {
    throw createError(500, 'Payment could not be loaded after cancellation');
  }

  return res.status(200).json({
    message: 'Payment voided successfully',
    payment: {
      ...formatPayment(deletedPayment, true),
      reason: reason || null,
    },
  });
};

const listPaymentLogs = async (req, res) => {
  const { skip, take } = parsePagination(req.query, 30, 200);
  const paymentId = req.params.paymentId || (typeof req.query.paymentId === 'string' ? req.query.paymentId.trim() : undefined);
  const orderId = typeof req.query.orderId === 'string' ? req.query.orderId.trim() : undefined;
  const adminId = typeof req.query.adminId === 'string' ? req.query.adminId.trim() : undefined;
  const action = typeof req.query.action === 'string' ? req.query.action.trim().toUpperCase() : undefined;
  const status = ensureEnumValue(req.query.status, PAYMENT_STATUSES, 'status');
  const createdAt = parseDateFilter(req.query.startDate, req.query.endDate, 'payment log date range');
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const and = [];
  if (status) {
    and.push({
      OR: [{ fromStatus: status }, { toStatus: status }],
    });
  }
  if (search) {
    and.push({
      OR: [
        { note: { contains: search, mode: 'insensitive' } },
        { orderNumberSnapshot: { contains: search, mode: 'insensitive' } },
        { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
        { payment: { gatewayOrderId: { contains: search, mode: 'insensitive' } } },
        { payment: { gatewayPaymentId: { contains: search, mode: 'insensitive' } } },
        { payment: { externalReference: { contains: search, mode: 'insensitive' } } },
        { admin: { fullName: { contains: search, mode: 'insensitive' } } },
        { admin: { email: { contains: search, mode: 'insensitive' } } },
      ],
    });
  }

  const where = {
    ...(paymentId ? { paymentId } : {}),
    ...(orderId ? { orderId } : {}),
    ...(adminId ? { adminId } : {}),
    ...(action ? { action } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(and.length ? { AND: and } : {}),
  };

  const [total, logs] = await prisma.$transaction([
    prisma.paymentLog.count({ where }),
    prisma.paymentLog.findMany({
      where,
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        payment: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
        admin: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return res.status(200).json({
    logs: logs.map((log) => ({
      ...formatPaymentLog(log),
      payment: log.payment ? formatPayment(log.payment) : null,
    })),
    pagination: buildPagination(total, skip, take),
  });
};

const listProducts = async (req, res) => {
  const { skip, take } = parsePagination(req.query, 20, 100);

  const category = ensureEnumValue(req.query.category, PRODUCT_CATEGORIES, 'category');
  const gender = ensureEnumValue(req.query.gender, PRODUCT_GENDERS, 'gender');
  const isActive = parseBool(req.query.isActive);
  const isFeatured = parseBool(req.query.isFeatured);
  if (req.query.isActive !== undefined && isActive === undefined) {
    throw createError(400, 'isActive must be true or false');
  }
  if (req.query.isFeatured !== undefined && isFeatured === undefined) {
    throw createError(400, 'isFeatured must be true or false');
  }
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const sort = (req.query.sort || 'newest').toString();

  const where = {
    ...(category ? { category } : {}),
    ...(gender ? { gender } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(isFeatured !== undefined ? { isFeatured } : {}),
    ...(search
      ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { brand: { contains: search, mode: 'insensitive' } },
        ],
      }
      : {}),
  };

  const include = {
    variants: {
      include: {
        inventory: true,
        images: {
          orderBy: {
            position: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    },
  };

  const total = await prisma.product.count({ where });

  let products;
  if (sort === 'newest') {
    products = await prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
      include,
    });
  } else if (sort === 'price_asc' || sort === 'price_desc') {
    const allProducts = await prisma.product.findMany({
      where,
      include,
      orderBy: {
        createdAt: 'desc',
      },
    });

    allProducts.sort((a, b) => {
      const aPrice = Math.min(...(a.variants.map((variant) => toNumber(variant.price)).filter(Number.isFinite)));
      const bPrice = Math.min(...(b.variants.map((variant) => toNumber(variant.price)).filter(Number.isFinite)));

      const safeAPrice = Number.isFinite(aPrice) ? aPrice : Number.MAX_SAFE_INTEGER;
      const safeBPrice = Number.isFinite(bPrice) ? bPrice : Number.MAX_SAFE_INTEGER;

      if (sort === 'price_asc') {
        return safeAPrice - safeBPrice;
      }

      return safeBPrice - safeAPrice;
    });

    products = allProducts.slice(skip, skip + take);
  } else {
    throw createError(400, 'Invalid sort. Allowed: newest|price_asc|price_desc');
  }

  return res.status(200).json({
    products: products.map(formatProduct),
    pagination: buildPagination(total, skip, take),
  });
};

const getProductById = async (req, res) => {
  const { productId } = req.params;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      variants: {
        include: {
          inventory: true,
          images: {
            orderBy: {
              position: 'asc',
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  if (!product) {
    throw createError(404, 'Product not found');
  }

  return res.status(200).json(formatProduct(product));
};

const updateProduct = async (req, res) => {
  const { productId } = req.params;

  const category = ensureEnumValue(req.body?.category, PRODUCT_CATEGORIES, 'category');
  const gender = ensureEnumValue(req.body?.gender, PRODUCT_GENDERS, 'gender');
  const isActive = req.body?.isActive !== undefined ? parseBool(req.body.isActive) : undefined;
  const isFeatured = req.body?.isFeatured !== undefined ? parseBool(req.body.isFeatured) : undefined;
  if (req.body?.isActive !== undefined && isActive === undefined) {
    throw createError(400, 'isActive must be true or false');
  }
  if (req.body?.isFeatured !== undefined && isFeatured === undefined) {
    throw createError(400, 'isFeatured must be true or false');
  }
  const tags = parseTagsInput(req.body?.tags);

  const data = {
    ...(req.body?.name !== undefined ? { name: req.body.name } : {}),
    ...(req.body?.brand !== undefined ? { brand: req.body.brand } : {}),
    ...(req.body?.modelNumber !== undefined ? { modelNumber: req.body.modelNumber || null } : {}),
    ...(category ? { category } : {}),
    ...(gender ? { gender } : {}),
    ...(req.body?.description !== undefined ? { description: req.body.description || null } : {}),
    ...(req.body?.shortDescription !== undefined
      ? { shortDescription: req.body.shortDescription || null }
      : {}),
    ...(tags !== undefined ? { tags } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(isFeatured !== undefined ? { isFeatured } : {}),
  };

  if (Object.keys(data).length === 0) {
    throw createError(400, 'No valid fields provided to update');
  }

  const product = await prisma.product.update({
    where: { id: productId },
    data,
    include: {
      variants: {
        include: {
          inventory: true,
          images: {
            orderBy: {
              position: 'asc',
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  return res.status(200).json({
    message: 'Product updated successfully',
    product: formatProduct(product),
  });
};

const deleteProduct = async (req, res) => {
  const { productId } = req.params;

  await prisma.product.delete({
    where: {
      id: productId,
    },
  });

  return res.status(200).json({
    message: 'Product deleted successfully',
  });
};

const createVariant = async (req, res) => {
  const { productId } = req.params;

  const { size, color, sku } = req.body || {};
  const price = parseNumber(req.body?.price, NaN);
  const compareAtPrice = req.body?.compareAtPrice !== undefined
    ? parseNumber(req.body.compareAtPrice, NaN)
    : undefined;

  if (!size || !color || !sku || !Number.isFinite(price)) {
    throw createError(400, 'size, color, sku and price are required');
  }

  if (compareAtPrice !== undefined && !Number.isFinite(compareAtPrice)) {
    throw createError(400, 'compareAtPrice must be a valid number');
  }

  const isAvailable = req.body?.isAvailable !== undefined ? parseBool(req.body.isAvailable) : true;
  if (req.body?.isAvailable !== undefined && isAvailable === undefined) {
    throw createError(400, 'isAvailable must be true or false');
  }
  const quantity = req.body?.quantity !== undefined ? Number(req.body.quantity) : 0;
  const copyImagesFromVariantId = req.body?.copyImagesFromVariantId;

  if (!Number.isInteger(quantity) || quantity < 0) {
    throw createError(400, 'quantity must be a non-negative integer');
  }

  const variant = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw createError(404, 'Product not found');
    }

    const createdVariant = await tx.productVariant.create({
      data: {
        productId,
        size: String(size),
        color: String(color),
        sku: String(sku),
        price,
        ...(compareAtPrice !== undefined ? { compareAtPrice } : {}),
        ...(isAvailable !== undefined ? { isAvailable } : {}),
      },
      include: {
        inventory: true,
        images: {
          orderBy: { position: 'asc' },
        },
      },
    });

    await tx.inventory.create({
      data: {
        variantId: createdVariant.id,
        quantity,
      },
    });

    if (copyImagesFromVariantId) {
      const sourceVariant = await tx.productVariant.findFirst({
        where: {
          id: copyImagesFromVariantId,
          productId,
        },
        include: {
          images: {
            orderBy: {
              position: 'asc',
            },
          },
        },
      });

      if (!sourceVariant) {
        throw createError(404, 'copyImagesFromVariantId not found for this product');
      }

      if (sourceVariant.images.length > 0) {
        await tx.productImage.createMany({
          data: sourceVariant.images.map((image, index) => ({
            variantId: createdVariant.id,
            url: image.url,
            altText: image.altText,
            position: index,
            isPrimary: image.isPrimary,
          })),
        });
      }
    }

    return tx.productVariant.findUnique({
      where: { id: createdVariant.id },
      include: {
        inventory: true,
        images: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });
  });

  return res.status(201).json({
    message: 'Variant created successfully',
    variant: formatVariant(variant, true),
  });
};

const updateVariant = async (req, res) => {
  const { variantId } = req.params;

  const data = {
    ...(req.body?.size !== undefined ? { size: String(req.body.size) } : {}),
    ...(req.body?.color !== undefined ? { color: String(req.body.color) } : {}),
    ...(req.body?.sku !== undefined ? { sku: String(req.body.sku) } : {}),
    ...(req.body?.price !== undefined ? { price: Number(req.body.price) } : {}),
    ...(req.body?.compareAtPrice !== undefined
      ? {
        compareAtPrice:
          req.body.compareAtPrice === null || req.body.compareAtPrice === ''
            ? null
            : Number(req.body.compareAtPrice),
      }
      : {}),
    ...(req.body?.isAvailable !== undefined ? { isAvailable: parseBool(req.body.isAvailable) } : {}),
  };

  if (Object.keys(data).length === 0) {
    throw createError(400, 'No valid fields provided to update');
  }

  if (data.price !== undefined && !Number.isFinite(data.price)) {
    throw createError(400, 'price must be a valid number');
  }

  if (data.compareAtPrice !== undefined && data.compareAtPrice !== null && !Number.isFinite(data.compareAtPrice)) {
    throw createError(400, 'compareAtPrice must be a valid number');
  }

  if (data.isAvailable === undefined && req.body?.isAvailable !== undefined) {
    throw createError(400, 'isAvailable must be true or false');
  }

  const variant = await prisma.productVariant.update({
    where: { id: variantId },
    data,
    include: {
      inventory: true,
      images: {
        orderBy: {
          position: 'asc',
        },
      },
    },
  });

  return res.status(200).json({
    message: 'Variant updated successfully',
    variant: formatVariant(variant, true),
  });
};

const deleteVariant = async (req, res) => {
  const { variantId } = req.params;

  await prisma.productVariant.delete({
    where: { id: variantId },
  });

  return res.status(200).json({
    message: 'Variant deleted successfully',
  });
};

const getInventory = async (req, res) => {
  const { skip, take } = parsePagination(req.query, 20, 100);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const lowStockOnly = parseBool(req.query.lowStockOnly);

  if (req.query.lowStockOnly !== undefined && lowStockOnly === undefined) {
    throw createError(400, 'lowStockOnly must be true or false');
  }

  const where = {
    ...(search
      ? {
        OR: [
          { sku: { contains: search, mode: 'insensitive' } },
          { color: { contains: search, mode: 'insensitive' } },
          {
            product: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { brand: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      }
      : {}),
    ...(lowStockOnly ? { inventory: { quantity: { lte: 5 } } } : {}),
  };

  const [total, variants] = await prisma.$transaction([
    prisma.productVariant.count({ where }),
    prisma.productVariant.findMany({
      where,
      skip,
      take,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            category: true,
            gender: true,
          },
        },
        inventory: true,
      },
      orderBy: [
        {
          product: {
            name: 'asc',
          },
        },
        {
          sku: 'asc',
        },
      ],
    }),
  ]);

  return res.status(200).json({
    inventories: variants.map(formatInventoryRow),
    pagination: buildPagination(total, skip, take),
  });
};

const getInventoryByVariantId = async (req, res) => {
  const { variantId } = req.params;

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          brand: true,
          category: true,
          gender: true,
        },
      },
      inventory: true,
      inventoryLogs: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
      },
    },
  });

  if (!variant) {
    throw createError(404, 'Variant not found');
  }

  return res.status(200).json({
    ...formatInventoryRow(variant),
    logs: (variant.inventoryLogs || []).map((log) => ({
      id: log.id,
      type: log.type,
      quantity: log.quantity,
      note: log.note,
      performedBy: log.performedBy,
      orderId: log.orderId,
      createdAt: log.createdAt.toISOString(),
    })),
  });
};

const listInventoryLogs = async (req, res) => {
  const { skip, take } = parsePagination(req.query, 30, 200);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const type = ensureEnumValue(req.query.type, INVENTORY_LOG_TYPES, 'type');
  const variantId = typeof req.query.variantId === 'string' ? req.query.variantId.trim() : undefined;
  const orderId = typeof req.query.orderId === 'string' ? req.query.orderId.trim() : undefined;
  const createdAt = parseDateFilter(req.query.startDate, req.query.endDate, 'inventory log date range');

  const where = {
    ...(type ? { type } : {}),
    ...(variantId ? { variantId } : {}),
    ...(orderId ? { orderId } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(search
      ? {
        OR: [
          { note: { contains: search, mode: 'insensitive' } },
          { performedBy: { contains: search, mode: 'insensitive' } },
          { variant: { sku: { contains: search, mode: 'insensitive' } } },
          { variant: { product: { name: { contains: search, mode: 'insensitive' } } } },
          { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
        ],
      }
      : {}),
  };

  const [total, logs] = await prisma.$transaction([
    prisma.inventoryLog.count({ where }),
    prisma.inventoryLog.findMany({
      where,
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
        variant: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                brand: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return res.status(200).json({
    logs: logs.map((log) => ({
      id: log.id,
      variantId: log.variantId,
      type: log.type,
      quantity: log.quantity,
      note: log.note,
      performedBy: log.performedBy,
      order: log.order
        ? {
          id: log.order.id,
          orderNumber: log.order.orderNumber,
        }
        : null,
      variant: {
        id: log.variant.id,
        sku: log.variant.sku,
        size: log.variant.size,
        color: log.variant.color,
        product: {
          id: log.variant.product.id,
          name: log.variant.product.name,
          brand: log.variant.product.brand,
        },
      },
      createdAt: log.createdAt.toISOString(),
    })),
    pagination: buildPagination(total, skip, take),
  });
};

const adjustVariantInventory = async (req, res) => {
  const { variantId } = req.params;
  const operation = ensureEnumValue(req.body?.operation, INVENTORY_ADJUST_OPERATIONS, 'operation');
  const quantity = Number(req.body?.quantity);
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : undefined;
  const orderId = req.body?.orderId ? String(req.body.orderId) : null;
  const { performedBy } = getAdminActor(req);

  if (!operation) {
    throw createError(400, 'operation is required');
  }

  if (!Number.isInteger(quantity) || quantity < 0) {
    throw createError(400, 'quantity must be a non-negative integer');
  }

  if (operation !== 'SET' && quantity === 0) {
    throw createError(400, 'quantity must be greater than 0 for this operation');
  }

  const updatedVariant = await prisma.$transaction(async (tx) => {
    if (orderId) {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true },
      });
      if (!order) {
        throw createError(404, 'orderId not found');
      }
    }

    const variant = await tx.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            category: true,
            gender: true,
          },
        },
      },
    });

    if (!variant) {
      throw createError(404, 'Variant not found');
    }

    const inventory = await ensureLockedInventoryRowTx(tx, variantId);

    const currentQuantity = inventory.quantity;
    const currentReserved = inventory.reserved;
    let nextQuantity = currentQuantity;
    let nextReserved = currentReserved;
    let logType = 'MANUAL';
    let logQuantity = quantity;

    switch (operation) {
      case 'SET':
        nextQuantity = quantity;
        logType = nextQuantity >= currentQuantity ? 'RESTOCK' : 'MANUAL';
        logQuantity = Math.abs(nextQuantity - currentQuantity);
        break;
      case 'RESTOCK':
        nextQuantity = currentQuantity + quantity;
        logType = 'RESTOCK';
        break;
      case 'REDUCE':
        nextQuantity = currentQuantity - quantity;
        logType = 'MANUAL';
        break;
      case 'HOLD':
        nextReserved = currentReserved + quantity;
        logType = 'HOLD';
        break;
      case 'RELEASE':
        nextReserved = currentReserved - quantity;
        logType = 'RELEASE';
        break;
      case 'RETURN':
        nextQuantity = currentQuantity + quantity;
        logType = 'RETURN';
        break;
      default:
        throw createError(400, `Unsupported operation: ${operation}`);
    }

    if (nextQuantity < 0) {
      throw createError(400, 'Resulting inventory quantity cannot be negative');
    }

    if (nextReserved < 0) {
      throw createError(400, 'Resulting reserved quantity cannot be negative');
    }

    if (nextReserved > nextQuantity) {
      throw createError(400, 'reserved inventory cannot exceed total quantity');
    }

    if (nextQuantity === currentQuantity && nextReserved === currentReserved) {
      throw createError(400, 'No inventory change applied');
    }

    await tx.inventory.update({
      where: { id: inventory.id },
      data: {
        quantity: nextQuantity,
        reserved: nextReserved,
      },
    });

    await tx.inventoryLog.create({
      data: {
        variantId,
        orderId,
        quantity: logQuantity,
        type: logType,
        performedBy,
        note: note || `Inventory ${operation.toLowerCase()} via admin panel`,
      },
    });

    return tx.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            category: true,
            gender: true,
          },
        },
        inventory: true,
      },
    });
  });

  return res.status(200).json({
    message: 'Inventory adjusted successfully',
    operation,
    inventory: formatInventoryRow(updatedVariant),
  });
};

const updateVariantInventory = async (req, res) => {
  const { variantId } = req.params;
  const quantity = Number(req.body?.quantity);
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : undefined;
  const { performedBy } = getAdminActor(req);

  if (!Number.isInteger(quantity) || quantity < 0) {
    throw createError(400, 'quantity must be a non-negative integer');
  }

  const inventory = await prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) {
      throw createError(404, 'Variant not found');
    }

    const lockedInventory = await ensureLockedInventoryRowTx(tx, variantId);
    const previousQuantity = lockedInventory.quantity;
    const previousReserved = lockedInventory.reserved;

    if (previousReserved > quantity) {
      throw createError(400, `quantity must be >= reserved stock (${previousReserved})`);
    }

    const savedInventory = await tx.inventory.update({
      where: { id: lockedInventory.id },
      data: {
        quantity,
      },
    });

    const diff = quantity - previousQuantity;
    if (diff !== 0 || note) {
      await tx.inventoryLog.create({
        data: {
          variantId,
          quantity: Math.abs(diff),
          type: diff > 0 ? 'RESTOCK' : 'MANUAL',
          performedBy,
          note: note || (diff > 0
            ? 'Inventory restocked via admin panel'
            : diff < 0
              ? 'Inventory reduced via admin panel'
              : 'Inventory reviewed via admin panel'),
        },
      });
    }

    return savedInventory;
  });

  return res.status(200).json({
    message: 'Inventory updated successfully',
    inventory: {
      id: inventory.id,
      quantity: inventory.quantity,
      reserved: inventory.reserved,
    },
  });
};

const createVariantImage = async (req, res) => {
  const { variantId } = req.params;

  if (!req.file) {
    throw createError(400, 'image file is required');
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: {
      product: {
        select: {
          name: true,
        },
      },
      images: {
        orderBy: {
          position: 'desc',
        },
        take: 1,
      },
    },
  });

  if (!variant) {
    throw createError(404, 'Variant not found');
  }

  const optimized = await validateAndOptimizeImage(req.file.buffer);
  const imageUrl = await uploadBufferToS3(optimized, `products/${variant.productId}/${variant.id}`, req.file.mimetype);

  const parsedPosition = req.body?.position !== undefined ? Number(req.body.position) : null;
  const position = Number.isInteger(parsedPosition)
    ? parsedPosition
    : ((variant.images[0]?.position ?? -1) + 1);

  const isPrimary = req.body?.isPrimary !== undefined ? parseBool(req.body.isPrimary) : variant.images.length === 0;
  if (req.body?.isPrimary !== undefined && isPrimary === undefined) {
    throw createError(400, 'isPrimary must be true or false');
  }

  const image = await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.productImage.updateMany({
        where: { variantId },
        data: { isPrimary: false },
      });
    }

    return tx.productImage.create({
      data: {
        variantId,
        url: imageUrl,
        altText: req.body?.altText || `${variant.product.name} - ${variant.color} ${variant.size}`,
        position,
        isPrimary: Boolean(isPrimary),
      },
    });
  });

  return res.status(201).json({
    message: 'Image added successfully',
    image: formatImage(image),
  });
};

const copyVariantImages = async (req, res) => {
  const { variantId } = req.params;
  const { sourceVariantId } = req.body;

  if (!sourceVariantId) {
    throw createError(400, 'sourceVariantId is required');
  }

  const [targetVariant, sourceImages] = await Promise.all([
    prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: { select: { name: true } },
        images: { orderBy: { position: 'desc' }, take: 1 },
      },
    }),
    prisma.productImage.findMany({
      where: { variantId: sourceVariantId },
      orderBy: { position: 'asc' },
    }),
  ]);

  if (!targetVariant) {
    throw createError(404, 'Target variant not found');
  }

  if (sourceImages.length === 0) {
    return res.status(200).json({ message: 'No images to copy', images: [] });
  }

  const startPosition = (targetVariant.images[0]?.position ?? -1) + 1;
  const hasExistingImages = (targetVariant.images[0]?.position ?? -1) >= 0;

  const created = await prisma.$transaction(async (tx) => {
    const newImages = [];
    for (let i = 0; i < sourceImages.length; i++) {
      const src = sourceImages[i];
      const image = await tx.productImage.create({
        data: {
          variantId,
          url: src.url,
          altText: src.altText || `${targetVariant.product.name} - ${targetVariant.color} ${targetVariant.size}`,
          position: startPosition + i,
          isPrimary: !hasExistingImages && i === 0,
        },
      });
      newImages.push(image);
    }
    return newImages;
  });

  return res.status(201).json({
    message: `${created.length} image(s) copied successfully`,
    images: created.map(formatImage),
  });
};

const updateImage = async (req, res) => {
  const { imageId } = req.params;

  const existingImage = await prisma.productImage.findUnique({
    where: { id: imageId },
  });

  if (!existingImage) {
    throw createError(404, 'Image not found');
  }

  const parsedPosition = req.body?.position !== undefined ? Number(req.body.position) : undefined;
  if (parsedPosition !== undefined && !Number.isInteger(parsedPosition)) {
    throw createError(400, 'position must be an integer');
  }

  const parsedIsPrimary = req.body?.isPrimary !== undefined ? parseBool(req.body.isPrimary) : undefined;
  if (parsedIsPrimary === undefined && req.body?.isPrimary !== undefined) {
    throw createError(400, 'isPrimary must be true or false');
  }

  const image = await prisma.$transaction(async (tx) => {
    if (parsedIsPrimary) {
      await tx.productImage.updateMany({
        where: {
          variantId: existingImage.variantId,
          id: {
            not: imageId,
          },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    return tx.productImage.update({
      where: { id: imageId },
      data: {
        ...(req.body?.altText !== undefined ? { altText: req.body.altText || '' } : {}),
        ...(parsedPosition !== undefined ? { position: parsedPosition } : {}),
        ...(parsedIsPrimary !== undefined ? { isPrimary: parsedIsPrimary } : {}),
      },
    });
  });

  return res.status(200).json({
    message: 'Image updated successfully',
    image: formatImage(image),
  });
};

const deleteImage = async (req, res) => {
  const { imageId } = req.params;

  await prisma.productImage.delete({
    where: { id: imageId },
  });

  return res.status(200).json({
    message: 'Image deleted successfully',
  });
};

const createProduct = async (req, res) => {
  const { name, brand, modelNumber, category: categoryRaw, gender: genderRaw, description, shortDescription } = req.body;

  if (!name || !brand || !categoryRaw || !genderRaw) {
    throw createError(400, 'name, brand, category and gender are required');
  }

  const category = ensureEnumValue(categoryRaw, PRODUCT_CATEGORIES, 'category');
  const gender = ensureEnumValue(genderRaw, PRODUCT_GENDERS, 'gender');

  let variants;
  try {
    variants = parseVariantsInput(req.body.variants);
  } catch (error) {
    throw createError(400, error.message);
  }
  if (variants.length === 0) {
    throw createError(400, 'At least one variant is required');
  }

  const normalizedVariants = variants.map((variant, index) => {
    const price = Number(variant.price);
    const compareAtPrice = variant.compareAtPrice !== undefined && variant.compareAtPrice !== null && variant.compareAtPrice !== ''
      ? Number(variant.compareAtPrice)
      : undefined;
    const quantity = variant.quantity !== undefined ? Number(variant.quantity) : 0;

    if (!variant.size || !variant.color || !variant.sku || !Number.isFinite(price)) {
      throw createError(400, `Invalid variant at index ${index}. size, color, sku, price are required`);
    }

    if (compareAtPrice !== undefined && !Number.isFinite(compareAtPrice)) {
      throw createError(400, `Invalid compareAtPrice for variant index ${index}`);
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      throw createError(400, `Invalid quantity for variant index ${index}`);
    }

    const parsedAvailability = variant.isAvailable !== undefined ? parseBool(variant.isAvailable) : true;
    if (variant.isAvailable !== undefined && parsedAvailability === undefined) {
      throw createError(400, `Invalid isAvailable for variant index ${index}`);
    }

    return {
      size: String(variant.size),
      color: String(variant.color),
      sku: String(variant.sku),
      price,
      compareAtPrice,
      isAvailable: parsedAvailability,
      quantity,
    };
  });

  const tags = parseTagsInput(req.body.tags) || [];
  const parsedIsActive = req.body.isActive !== undefined ? parseBool(req.body.isActive) : true;
  const parsedIsFeatured = req.body.isFeatured !== undefined ? parseBool(req.body.isFeatured) : false;
  if (req.body.isActive !== undefined && parsedIsActive === undefined) {
    throw createError(400, 'isActive must be true or false');
  }
  if (req.body.isFeatured !== undefined && parsedIsFeatured === undefined) {
    throw createError(400, 'isFeatured must be true or false');
  }
  const isActive = parsedIsActive;
  const isFeatured = parsedIsFeatured;

  const created = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name: String(name),
        brand: String(brand),
        modelNumber: modelNumber || null,
        category,
        gender,
        description: description || null,
        shortDescription: shortDescription || null,
        tags,
        isActive,
        isFeatured,
      },
    });

    const createdVariants = [];

    for (const variant of normalizedVariants) {
      const createdVariant = await tx.productVariant.create({
        data: {
          productId: product.id,
          size: variant.size,
          color: variant.color,
          sku: variant.sku,
          price: variant.price,
          ...(variant.compareAtPrice !== undefined ? { compareAtPrice: variant.compareAtPrice } : {}),
          isAvailable: variant.isAvailable,
        },
      });

      await tx.inventory.create({
        data: {
          variantId: createdVariant.id,
          quantity: variant.quantity,
        },
      });

      createdVariants.push(createdVariant);
    }

    return { product, variants: createdVariants };
  });

  const files = Array.isArray(req.files) ? req.files : [];
  const hasColorImageGroups = req.body.colorImageGroups !== undefined;

  if (hasColorImageGroups) {
    const colorImageGroups = parseProductColorImageGroups(req.body.colorImageGroups);
    const filesByFieldName = new Map();
    files.forEach((file) => {
      const fieldFiles = filesByFieldName.get(file.fieldname) || [];
      fieldFiles.push(file);
      filesByFieldName.set(file.fieldname, fieldFiles);
    });

    const variantsByColorKey = new Map();
    created.variants.forEach((variant) => {
      const colorKey = normalizeColorKey(variant.color);
      variantsByColorKey.set(colorKey, [...(variantsByColorKey.get(colorKey) || []), variant]);
    });

    const nextPositionByVariantId = new Map(created.variants.map((variant) => [variant.id, 0]));

    for (const group of colorImageGroups) {
      const groupFiles = filesByFieldName.get(group.fieldName) || [];
      if (groupFiles.length === 0) {
        throw createError(400, `No image file found for ${group.fieldName}`);
      }

      const targetVariants = group.colorKeys.flatMap((colorKey) => variantsByColorKey.get(colorKey) || []);
      if (targetVariants.length === 0) {
        throw createError(400, `No variant color matches image field ${group.fieldName}`);
      }

      for (const file of groupFiles) {
        const optimized = await validateAndOptimizeImage(file.buffer);
        const colorFolder = sanitizePathSegment(group.colors[0], 'color');
        const imageUrl = await uploadBufferToS3(optimized, `products/${created.product.id}/colors/${colorFolder}`, file.mimetype);

        await prisma.productImage.createMany({
          data: targetVariants.map((variant) => {
            const position = nextPositionByVariantId.get(variant.id) || 0;
            nextPositionByVariantId.set(variant.id, position + 1);

            return {
              variantId: variant.id,
              url: imageUrl,
              altText: `${created.product.name} - ${variant.color} ${variant.size}`,
              position,
              isPrimary: position === 0,
            };
          }),
        });
      }
    }
  } else {
    for (let i = 0; i < created.variants.length; i += 1) {
      const variant = created.variants[i];
      const variantFiles = files.filter((file) => file.fieldname === `images_${i}`);

      for (let idx = 0; idx < variantFiles.length; idx += 1) {
        const file = variantFiles[idx];
        const optimized = await validateAndOptimizeImage(file.buffer);
        const imageUrl = await uploadBufferToS3(optimized, `products/${created.product.id}/${variant.id}`, file.mimetype);

        await prisma.productImage.create({
          data: {
            variantId: variant.id,
            url: imageUrl,
            altText: `${created.product.name} - ${variant.color} ${variant.size}`,
            position: idx,
            isPrimary: idx === 0,
          },
        });
      }
    }
  }

  const product = await prisma.product.findUnique({
    where: { id: created.product.id },
    include: {
      variants: {
        include: {
          inventory: true,
          images: {
            orderBy: {
              position: 'asc',
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  return res.status(201).json({
    message: 'Product created successfully',
    product: formatProduct(product),
  });
};

const getAnalytics = async (req, res) => {
  const period = req.query.period || '7d';

  let range;
  try {
    range = getPeriodRange({
      period,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
  } catch (error) {
    throw createError(400, error.message);
  }

  const { start, end } = range;

  const [orders, statusGroups, paymentMethodGroups, topProductGroups] = await prisma.$transaction([
    prisma.order.findMany({
      where: {
        deletedAt: null,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        createdAt: true,
        totalAmount: true,
        paymentStatus: true,
        status: true,
        paymentMethod: true,
      },
    }),
    prisma.order.groupBy({
      by: ['status'],
      where: {
        deletedAt: null,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      _count: {
        status: true,
      },
    }),
    prisma.order.groupBy({
      by: ['paymentMethod'],
      where: {
        deletedAt: null,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      _count: {
        paymentMethod: true,
      },
    }),
    prisma.orderItem.groupBy({
      by: ['productName'],
      where: {
        order: {
          deletedAt: null,
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      },
      _sum: {
        quantity: true,
        subtotal: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: 5,
    }),
  ]);

  const totalRevenue = orders
    .filter((order) => order.paymentStatus === 'SUCCESS')
    .reduce((sum, order) => sum + (toNumber(order.totalAmount) || 0), 0);

  const totalOrders = orders.length;

  const timeseriesMap = {};
  let pointer = startOfUtcDay(start);
  const endDate = endOfUtcDay(end);

  while (pointer <= endDate) {
    timeseriesMap[toDateOnly(pointer)] = { revenue: 0, orders: 0 };
    pointer = addDaysUtc(pointer, 1);
  }

  orders.forEach((order) => {
    const key = toDateOnly(order.createdAt);
    if (!timeseriesMap[key]) {
      timeseriesMap[key] = { revenue: 0, orders: 0 };
    }

    timeseriesMap[key].orders += 1;
    if (order.paymentStatus === 'SUCCESS') {
      timeseriesMap[key].revenue += toNumber(order.totalAmount) || 0;
    }
  });

  const revenueTimeseries = Object.entries(timeseriesMap).map(([date, data]) => ({
    date,
    revenue: Number(data.revenue.toFixed(2)),
    orders: data.orders,
  }));

  const statusBreakdown = ORDER_STATUSES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});

  statusGroups.forEach((entry) => {
    statusBreakdown[entry.status] = entry._count.status;
  });

  const paymentMethodBreakdown = {
    RAZORPAY: 0,
    COD: 0,
  };

  paymentMethodGroups.forEach((entry) => {
    paymentMethodBreakdown[entry.paymentMethod] = entry._count.paymentMethod;
  });

  const topProducts = await Promise.all(
    topProductGroups.map(async (group) => {
      const orderItem = await prisma.orderItem.findFirst({
        where: {
          productName: group.productName,
        },
        include: {
          variant: {
            include: {
              images: {
                orderBy: {
                  position: 'asc',
                },
              },
            },
          },
        },
      });

      const primaryImage = orderItem?.variant?.images?.find((image) => image.isPrimary)
        || orderItem?.variant?.images?.[0]
        || null;

      return {
        productName: group.productName,
        imageUrl: primaryImage?.url || null,
        unitsSold: group._sum.quantity || 0,
        revenue: Number((toNumber(group._sum.subtotal) || 0).toFixed(2)),
      };
    })
  );

  return res.status(200).json({
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalOrders,
    revenueTimeseries,
    statusBreakdown,
    paymentMethodBreakdown,
    topProducts,
  });
};

const getNotificationHistory = async (req, res) => {
  const { skip, take } = parsePagination(req.query, 20, 100);

  const [notifications, unreadCount, total] = await prisma.$transaction([
    prisma.notificationHistory.findMany({
      where: {
        userId: req.user.id,
      },
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.notificationHistory.count({
      where: {
        userId: req.user.id,
        isRead: false,
      },
    }),
    prisma.notificationHistory.count({
      where: {
        userId: req.user.id,
      },
    }),
  ]);

  return res.status(200).json({
    notifications: notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      url: notification.url,
      icon: notification.icon,
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
    })),
    unreadCount,
    pagination: buildPagination(total, skip, take),
  });
};

const markNotificationAsRead = async (req, res) => {
  const { notificationId } = req.params;

  const result = await prisma.notificationHistory.updateMany({
    where: {
      id: notificationId,
      userId: req.user.id,
    },
    data: {
      isRead: true,
    },
  });

  if (result.count === 0) {
    throw createError(404, 'Notification not found');
  }

  return res.status(200).json({
    message: 'Notification marked as read',
  });
};

const markAllNotificationsAsRead = async (req, res) => {
  await prisma.notificationHistory.updateMany({
    where: {
      userId: req.user.id,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  return res.status(200).json({
    message: 'All notifications marked as read',
  });
};

const subscribeNotifications = async (req, res) => {
  const { endpoint, keys, userAgent } = req.body || {};

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw createError(400, 'endpoint and keys { p256dh, auth } are required');
  }

  await prisma.pushSubscription.upsert({
    where: {
      endpoint,
    },
    create: {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent || null,
      userId: req.user.id,
    },
    update: {
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent || null,
      userId: req.user.id,
      sessionId: null,
    },
  });

  return res.status(200).json({
    message: 'Subscription saved successfully',
  });
};

const unsubscribeNotifications = async (req, res) => {
  const { endpoint } = req.body || {};

  if (!endpoint) {
    throw createError(400, 'endpoint is required');
  }

  await prisma.pushSubscription.deleteMany({
    where: {
      endpoint,
      userId: req.user.id,
    },
  });

  return res.status(200).json({
    message: 'Subscription removed successfully',
  });
};

const getNotificationPreferences = async (req, res) => {
  let preferences = await prisma.notificationPreferences.findUnique({
    where: {
      userId: req.user.id,
    },
  });

  if (!preferences) {
    preferences = await prisma.notificationPreferences.create({
      data: {
        userId: req.user.id,
      },
    });
  }

  return res.status(200).json({
    newOrders: preferences.newOrders,
    orderStatusChange: preferences.orderStatusChange,
    lowStock: preferences.lowStock,
    otherEvents: preferences.otherEvents,
  });
};

const updateNotificationPreferences = async (req, res) => {
  const updateData = {};

  if (req.body?.newOrders !== undefined) {
    const value = parseBool(req.body.newOrders);
    if (value === undefined) {
      throw createError(400, 'newOrders must be true or false');
    }
    updateData.newOrders = value;
  }

  if (req.body?.orderStatusChange !== undefined) {
    const value = parseBool(req.body.orderStatusChange);
    if (value === undefined) {
      throw createError(400, 'orderStatusChange must be true or false');
    }
    updateData.orderStatusChange = value;
  }

  if (req.body?.lowStock !== undefined) {
    const value = parseBool(req.body.lowStock);
    if (value === undefined) {
      throw createError(400, 'lowStock must be true or false');
    }
    updateData.lowStock = value;
  }

  if (req.body?.otherEvents !== undefined) {
    const value = parseBool(req.body.otherEvents);
    if (value === undefined) {
      throw createError(400, 'otherEvents must be true or false');
    }
    updateData.otherEvents = value;
  }

  if (Object.keys(updateData).length === 0) {
    throw createError(400, 'No valid preferences provided');
  }

  const preferences = await prisma.notificationPreferences.upsert({
    where: {
      userId: req.user.id,
    },
    create: {
      userId: req.user.id,
      ...updateData,
    },
    update: updateData,
  });

  return res.status(200).json({
    message: 'Notification preferences updated',
    preferences: {
      newOrders: preferences.newOrders,
      orderStatusChange: preferences.orderStatusChange,
      lowStock: preferences.lowStock,
      otherEvents: preferences.otherEvents,
    },
  });
};

const broadcastNotification = async (req, res) => {
  const { title, body, url, icon } = req.body || {};

  if (!title || !body) {
    throw createError(400, 'title and body are required');
  }

  const payload = {
    title,
    body,
    url: url || '/',
    icon: icon || '/icons/web-app-manifest-192x192.png',
    badge: '/icons/web-app-manifest-192x192.png',
  };

  const pushResult = await notificationService.broadcastToAll(payload, { onlyUsers: true });

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      userId: {
        not: null,
      },
    },
    select: {
      userId: true,
    },
  });

  const uniqueUserIds = [...new Set(subscriptions.map((subscription) => subscription.userId).filter(Boolean))];

  if (uniqueUserIds.length > 0) {
    await prisma.notificationHistory.createMany({
      data: uniqueUserIds.map((userId) => ({
        userId,
        title,
        body,
        url: url || null,
        icon: payload.icon,
      })),
    });
  }

  return res.status(200).json({
    message: 'Notification broadcast sent',
    sentCount: pushResult.sent || 0,
    failedCount: pushResult.failed || 0,
    totalSubscriptions: pushResult.total || subscriptions.length,
    totalRecipients: uniqueUserIds.length,
  });
};

module.exports = {
  getDashboard,
  listOrders,
  listOrderLogs,
  getOrderById,
  updateOrderStatus,
  shareOrderStatusEmail,
  resendOrderStatusEmail,
  updateOrderPaymentStatus,
  listPayments,
  listPaymentLogs,
  getPaymentById,
  createPaymentForOrder,
  updatePaymentById,
  deletePaymentById,
  updateOrderShipment,
  deleteOrder,
  listShipments,
  listShipmentLogs,
  getShipmentById,
  createShipmentForOrder,
  updateShipmentById,
  deleteShipmentById,
  listProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  createVariant,
  updateVariant,
  deleteVariant,
  getInventory,
  listInventoryLogs,
  getInventoryByVariantId,
  adjustVariantInventory,
  updateVariantInventory,
  createVariantImage,
  copyVariantImages,
  updateImage,
  deleteImage,
  createProduct,
  getAnalytics,
  getNotificationHistory,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  subscribeNotifications,
  unsubscribeNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  broadcastNotification,
};
