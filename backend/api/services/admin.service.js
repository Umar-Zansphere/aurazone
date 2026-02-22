const prisma = require('../../config/prisma');
const { createError } = require('../../utils/error');
const { uploadBufferToS3 } = require('../services/s3.services');
const { validateAndOptimizeImage } = require('../../utils/imageProcessor');

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
    createdAt: order.createdAt.toISOString(),
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
    payments: (order.payments || []).map((payment) => ({
      id: payment.id,
      gateway: payment.gateway,
      gatewayPaymentId: payment.gatewayPaymentId,
      amount: toNumber(payment.amount),
      status: payment.status,
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
    })),
    statusTimeline: buildOrderStatusTimeline(order, latestShipment),
  };
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
        createdAt: { gte: todayStart, lte: todayEnd },
        paymentStatus: 'SUCCESS',
      },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.findMany({
      where: {
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
      _count: { status: true },
    }),
    prisma.inventory.count({
      where: {
        quantity: { lte: 5 },
      },
    }),
    prisma.orderItem.groupBy({
      by: ['variantId'],
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
  ]);

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

  const where = {
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
        orderBy: {
          createdAt: 'desc',
        },
      },
      payments: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  if (!order) {
    throw createError(404, 'Order not found');
  }

  return res.status(200).json(formatFullOrder(order));
};

const updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const status = ensureEnumValue(req.body?.status, ORDER_STATUSES, 'status');

  if (!status) {
    throw createError(400, 'status is required');
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw createError(404, 'Order not found');
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status,
      },
    });

    if (status === 'SHIPPED' || status === 'DELIVERED') {
      const currentShipment = await tx.orderShipment.findFirst({
        where: { orderId },
        orderBy: { createdAt: 'desc' },
      });

      const shipmentStatus = status === 'SHIPPED' ? 'SHIPPED' : 'DELIVERED';

      if (currentShipment) {
        await tx.orderShipment.update({
          where: { id: currentShipment.id },
          data: {
            status: shipmentStatus,
            ...(status === 'SHIPPED' && !currentShipment.shippedAt ? { shippedAt: new Date() } : {}),
          },
        });
      } else {
        await tx.orderShipment.create({
          data: {
            orderId,
            status: shipmentStatus,
            shippedAt: status === 'SHIPPED' ? new Date() : null,
          },
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
        },
      },
      items: {
        select: {
          quantity: true,
        },
      },
      shipments: {
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

  return res.status(200).json({
    message: 'Order status updated successfully',
    order: formatOrderSummary(updatedOrder),
  });
};

const updateOrderPaymentStatus = async (req, res) => {
  const { orderId } = req.params;
  const paymentStatus = ensureEnumValue(req.body?.paymentStatus, PAYMENT_STATUSES, 'paymentStatus');

  if (!paymentStatus) {
    throw createError(400, 'paymentStatus is required');
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
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

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus,
        ...(paymentStatus === 'SUCCESS' && order.status === 'PENDING' ? { status: 'PAID' } : {}),
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
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    const latestPayment = order.payments?.[0] || null;
    if (latestPayment) {
      await tx.payment.update({
        where: { id: latestPayment.id },
        data: {
          status: paymentStatus,
          paidAt: paymentStatus === 'SUCCESS' ? new Date() : null,
        },
      });
    } else {
      const gatewayOrderId = order.razorpayOrderId || `manual-order-${order.id}`;
      const gatewayPaymentId = order.razorpayPaymentId || `manual-payment-${order.id}`;

      await tx.payment.create({
        data: {
          orderId: order.id,
          gateway: order.paymentMethod,
          gatewayOrderId,
          gatewayPaymentId,
          amount: order.totalAmount,
          status: paymentStatus,
          paidAt: paymentStatus === 'SUCCESS' ? new Date() : null,
        },
      });
    }

    return updated;
  });

  return res.status(200).json({
    message: 'Order payment status updated successfully',
    order: formatOrderSummary(updatedOrder),
  });
};

const updateOrderShipment = async (req, res) => {
  const { orderId } = req.params;
  const shipmentStatus = ensureEnumValue(req.body?.status, SHIPMENT_STATUSES, 'status');

  const payload = {
    ...(req.body.courierName !== undefined ? { courierName: req.body.courierName || null } : {}),
    ...(req.body.trackingNumber !== undefined ? { trackingNumber: req.body.trackingNumber || null } : {}),
    ...(req.body.trackingUrl !== undefined ? { trackingUrl: req.body.trackingUrl || null } : {}),
    ...(shipmentStatus ? { status: shipmentStatus } : {}),
  };

  const shipment = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw createError(404, 'Order not found');
    }

    const existingShipment = await tx.orderShipment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });

    const shouldSetShippedAt = shipmentStatus === 'SHIPPED' || shipmentStatus === 'DELIVERED';

    let savedShipment;
    if (existingShipment) {
      savedShipment = await tx.orderShipment.update({
        where: { id: existingShipment.id },
        data: {
          ...payload,
          ...(shouldSetShippedAt && !existingShipment.shippedAt ? { shippedAt: new Date() } : {}),
        },
      });
    } else {
      savedShipment = await tx.orderShipment.create({
        data: {
          orderId,
          ...payload,
          ...(shouldSetShippedAt ? { shippedAt: new Date() } : {}),
        },
      });
    }

    if (shipmentStatus === 'SHIPPED' || shipmentStatus === 'DELIVERED') {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: shipmentStatus === 'SHIPPED' ? 'SHIPPED' : 'DELIVERED',
        },
      });
    }

    return savedShipment;
  });

  return res.status(200).json({
    message: 'Shipment updated successfully',
    shipment: {
      id: shipment.id,
      courierName: shipment.courierName,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      status: shipment.status,
      shippedAt: shipment.shippedAt ? shipment.shippedAt.toISOString() : null,
    },
  });
};

const deleteOrder = async (req, res) => {
  const { orderId } = req.params;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : undefined;

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

  await prisma.order.delete({
    where: { id: orderId },
  });

  return res.status(200).json({
    message: 'Order deleted successfully',
    order: {
      ...formatOrderSummary(order),
      reason: reason || null,
    },
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

const updateVariantInventory = async (req, res) => {
  const { variantId } = req.params;
  const quantity = Number(req.body?.quantity);

  if (!Number.isInteger(quantity) || quantity < 0) {
    throw createError(400, 'quantity must be a non-negative integer');
  }

  const inventory = await prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) {
      throw createError(404, 'Variant not found');
    }

    const existingInventory = await tx.inventory.findUnique({ where: { variantId } });
    const previousQuantity = existingInventory?.quantity || 0;

    const savedInventory = await tx.inventory.upsert({
      where: { variantId },
      create: {
        variantId,
        quantity,
      },
      update: {
        quantity,
      },
    });

    const diff = quantity - previousQuantity;
    if (diff !== 0) {
      await tx.inventoryLog.create({
        data: {
          variantId,
          quantity: Math.abs(diff),
          type: diff > 0 ? 'RESTOCK' : 'MANUAL',
          performedBy: req.user?.id || 'admin',
          note: diff > 0 ? 'Inventory restocked via admin panel' : 'Inventory reduced via admin panel',
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
  const { title, body, url } = req.body || {};

  if (!title || !body) {
    throw createError(400, 'title and body are required');
  }

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
      })),
    });
  }

  return res.status(200).json({
    message: 'Notification broadcast queued',
    sentCount: subscriptions.length,
  });
};

module.exports = {
  getDashboard,
  listOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderPaymentStatus,
  updateOrderShipment,
  deleteOrder,
  listProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  createVariant,
  updateVariant,
  deleteVariant,
  getInventory,
  getInventoryByVariantId,
  updateVariantInventory,
  createVariantImage,
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
