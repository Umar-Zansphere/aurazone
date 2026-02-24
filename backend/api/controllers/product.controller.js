const productService = require('../services/product.services');
// ======================== CUSTOMER-FACING PRODUCT CONTROLLERS ========================

const getFilterOptions = async (req, res, next) => {
  try {
    const filters = await productService.getFilterOptions();
    res.json({
      success: true,
      data: filters
    });
  } catch (error) {
    next(error);
  }
};

const getPopularProducts = async (req, res, next) => {
  try {
    const { skip, take } = req.query;
    const result = await productService.getPopularProducts(skip, take);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getProductsByBrand = async (req, res, next) => {
  try {
    const { brandName } = req.params;
    const { skip, take } = req.query;

    if (!brandName) {
      return res.status(400).json({ message: 'Brand name is required' });
    }

    const result = await productService.getProductsByBrand(brandName, skip, take);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getProductsByCategory = async (req, res, next) => {
  try {
    const { categoryName } = req.params;
    const { skip, take } = req.query;

    if (!categoryName) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const result = await productService.getProductsByCategory(categoryName, skip, take);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getProductsByGender = async (req, res, next) => {
  try {
    const { genderName } = req.params;
    const { skip, take } = req.query;

    if (!genderName) {
      return res.status(400).json({ message: 'Gender name is required' });
    }

    const result = await productService.getProductsByGender(genderName, skip, take);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getProductsByColor = async (req, res, next) => {
  try {
    const { colorName } = req.params;
    const { skip, take } = req.query;

    if (!colorName) {
      return res.status(400).json({ message: 'Color name is required' });
    }

    const result = await productService.getProductsByColor(colorName, skip, take);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getProductsBySize = async (req, res, next) => {
  try {
    const { sizeValue } = req.params;
    const { skip, take } = req.query;

    if (!sizeValue) {
      return res.status(400).json({ message: 'Size value is required' });
    }

    const result = await productService.getProductsBySize(sizeValue, skip, take);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getProductsByModel = async (req, res, next) => {
  try {
    const { modelNumber } = req.params;
    const { skip, take } = req.query;

    if (!modelNumber) {
      return res.status(400).json({ message: 'Model number is required' });
    }

    const result = await productService.getProductsByModel(modelNumber, skip, take);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const searchProducts = async (req, res, next) => {
  try {
    const filters = req.query;
    const result = await productService.searchProducts(filters);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getProductsList = async (req, res, next) => {
  try {
    const filters = req.query;
    const result = await productService.getProductsList(filters);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getProductDetail = async (req, res, next) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    const product = await productService.getProductDetail(productId);
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    if (error.message === 'Product not found') {
      return res.status(404).json({ message: 'Product not found' });
    }
    next(error);
  }
};

module.exports = {
  // Customer-facing controllers
  getFilterOptions,
  getPopularProducts,
  getProductsByBrand,
  getProductsByCategory,
  getProductsByGender,
  getProductsByColor,
  getProductsBySize,
  getProductsByModel,
  searchProducts,
  getProductsList,
  getProductDetail
};
