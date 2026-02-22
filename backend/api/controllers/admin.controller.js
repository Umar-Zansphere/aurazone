const catchAsync = require('../../utils/catchAsync');
const adminService = require('../services/admin.service');

const getDashboard = catchAsync(async (req, res) => adminService.getDashboard(req, res));

const listOrders = catchAsync(async (req, res) => adminService.listOrders(req, res));
const getOrderById = catchAsync(async (req, res) => adminService.getOrderById(req, res));
const updateOrderStatus = catchAsync(async (req, res) => adminService.updateOrderStatus(req, res));
const updateOrderPaymentStatus = catchAsync(async (req, res) => adminService.updateOrderPaymentStatus(req, res));
const updateOrderShipment = catchAsync(async (req, res) => adminService.updateOrderShipment(req, res));
const deleteOrder = catchAsync(async (req, res) => adminService.deleteOrder(req, res));

const listProducts = catchAsync(async (req, res) => adminService.listProducts(req, res));
const getProductById = catchAsync(async (req, res) => adminService.getProductById(req, res));
const updateProduct = catchAsync(async (req, res) => adminService.updateProduct(req, res));
const deleteProduct = catchAsync(async (req, res) => adminService.deleteProduct(req, res));
const createVariant = catchAsync(async (req, res) => adminService.createVariant(req, res));
const updateVariant = catchAsync(async (req, res) => adminService.updateVariant(req, res));
const deleteVariant = catchAsync(async (req, res) => adminService.deleteVariant(req, res));
const getInventory = catchAsync(async (req, res) => adminService.getInventory(req, res));
const getInventoryByVariantId = catchAsync(async (req, res) => adminService.getInventoryByVariantId(req, res));
const updateVariantInventory = catchAsync(async (req, res) => adminService.updateVariantInventory(req, res));
const createVariantImage = catchAsync(async (req, res) => adminService.createVariantImage(req, res));
const updateImage = catchAsync(async (req, res) => adminService.updateImage(req, res));
const deleteImage = catchAsync(async (req, res) => adminService.deleteImage(req, res));
const createProduct = catchAsync(async (req, res) => adminService.createProduct(req, res));

const getAnalytics = catchAsync(async (req, res) => adminService.getAnalytics(req, res));

const getNotificationHistory = catchAsync(async (req, res) => adminService.getNotificationHistory(req, res));
const markNotificationAsRead = catchAsync(async (req, res) => adminService.markNotificationAsRead(req, res));
const markAllNotificationsAsRead = catchAsync(async (req, res) => adminService.markAllNotificationsAsRead(req, res));
const subscribeNotifications = catchAsync(async (req, res) => adminService.subscribeNotifications(req, res));
const unsubscribeNotifications = catchAsync(async (req, res) => adminService.unsubscribeNotifications(req, res));
const getNotificationPreferences = catchAsync(async (req, res) => adminService.getNotificationPreferences(req, res));
const updateNotificationPreferences = catchAsync(async (req, res) => adminService.updateNotificationPreferences(req, res));
const broadcastNotification = catchAsync(async (req, res) => adminService.broadcastNotification(req, res));

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
