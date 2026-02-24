const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

// ======================== PUBLIC PRODUCT ROUTES (Customer Facing) ========================

// Get filterable options (brands, categories, colors, sizes, genders)
router.get('/filters/options', productController.getFilterOptions);
// Get most popular products (featured or by sales)
router.get('/popular', productController.getPopularProducts);

// Get products by brand
router.get('/brand/:brandName', productController.getProductsByBrand);

// Get products by category
router.get('/category/:categoryName', productController.getProductsByCategory);

// Get products by gender
router.get('/gender/:genderName', productController.getProductsByGender);

// Get products by color (from variants)
router.get('/color/:colorName', productController.getProductsByColor);

// Get products by size (from variants)
router.get('/size/:sizeValue', productController.getProductsBySize);

// Get products by model number
router.get('/model/:modelNumber', productController.getProductsByModel);

// Search products with multiple filters
// Query params: search, category, gender, color, size, brand, minPrice, maxPrice, skip, take
router.get('/search', productController.searchProducts);

// Get all products (with optional filters)
router.get('/', productController.getProductsList);

// Get product by ID
router.get('/:productId', productController.getProductDetail);

module.exports = router;
