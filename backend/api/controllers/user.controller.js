const userService = require('../services/user.services');

// Get user profile
const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await userService.getUserProfile(userId);
    res.json(user);
  } catch (error) {
    next(error);
  }
};

// Update user profile
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { fullName, email } = req.body;

    if (!fullName && !email) {
      return res.status(400).json({ message: 'At least one field (fullName or email) is required' });
    }

    const result = await userService.updateProfile(userId, { fullName, email });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// Update phone number
const updatePhoneNumber = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { phoneNumber } = req.body;

    if (!phoneNumber || phoneNumber.trim().length < 10) {
      return res.status(400).json({ message: 'Valid phone number is required' });
    }

    const result = await userService.updatePhoneNumber(userId, phoneNumber);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// Get all addresses
const getAddresses = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const addresses = await userService.getUserAddresses(userId);
    res.json(addresses);
  } catch (error) {
    next(error);
  }
};

// Get single address
const getAddressById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;

    if (!addressId) {
      return res.status(400).json({ message: 'Address ID is required' });
    }

    const address = await userService.getAddressById(userId, addressId);
    res.json(address);
  } catch (error) {
    next(error);
  }
};

// Create address
const createAddress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, phone, addressLine1, addressLine2, city, state, postalCode, country, isDefault } = req.body;

    const result = await userService.createAddress(userId, {
      name,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      isDefault
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

// Update address
const updateAddress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;
    const { name, phone, addressLine1, addressLine2, city, state, postalCode, country, isDefault } = req.body;

    if (!addressId) {
      return res.status(400).json({ message: 'Address ID is required' });
    }

    const result = await userService.updateAddress(userId, addressId, {
      name,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      isDefault
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

// Delete address
const deleteAddress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;

    if (!addressId) {
      return res.status(400).json({ message: 'Address ID is required' });
    }

    const result = await userService.deleteAddress(userId, addressId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// Set default address
const setDefaultAddress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;

    if (!addressId) {
      return res.status(400).json({ message: 'Address ID is required' });
    }

    const result = await userService.setDefaultAddress(userId, addressId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updatePhoneNumber,
  getAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};
