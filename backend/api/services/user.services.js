const prisma = require('../../config/prisma');

// Get user profile
const getUserProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      is_email_verified: true,
      is_phone_verified: true,
      is_active: true,
      role: true,
      last_login_at: true,
      createdAt: true,
      updatedAt: true,
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  return user;
};

// Update user profile (name, email)
const updateProfile = async (userId, { fullName, email }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }

  // If email is being changed, check if it's already in use
  if (email && email !== user.email) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('Email already in use');
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(fullName && { fullName }),
      ...(email && { email, is_email_verified: null }), // Reset email verification if email changed
    },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      is_email_verified: true,
      is_phone_verified: true,
      is_active: true,
      role: true,
      updatedAt: true,
    }
  });

  return {
    message: 'Profile updated successfully',
    user: updatedUser
  };
};

// Update phone number
const updatePhoneNumber = async (userId, phoneNumber) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }

  // Check if phone number is already registered
  const existingUser = await prisma.user.findFirst({
    where: {
      phone: phoneNumber,
      id: { not: userId }
    }
  });

  if (existingUser) {
    throw new Error('Phone number already registered');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      phone: phoneNumber,
      is_phone_verified: null, // Reset phone verification until verified
    },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      is_phone_verified: true,
    }
  });

  return {
    message: 'Phone number updated. Please verify your new phone number.',
    user: updatedUser
  };
};

// Get all user addresses
const getUserAddresses = async (userId) => {
  const addresses = await prisma.address.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });

  return addresses;
};

// Get single address
const getAddressById = async (userId, addressId) => {
  const address = await prisma.address.findFirst({
    where: {
      id: addressId,
      userId
    }
  });

  if (!address) {
    throw new Error('Address not found');
  }

  return address;
};

// Add new address
const createAddress = async (userId, addressData) => {
  const { name, phone, addressLine1, addressLine2, city, state, postalCode, country, isDefault } = addressData;

  // Validate required fields
  if (!name || !phone || !addressLine1 || !city || !state || !postalCode || !country) {
    throw new Error('Missing required fields');
  }

  // If this is set as default, unset other defaults
  if (isDefault) {
    await prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false }
    });
  }

  const address = await prisma.address.create({
    data: {
      userId,
      name,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      isDefault: isDefault || false
    }
  });

  return {
    message: 'Address added successfully',
    address
  };
};

// Update address
const updateAddress = async (userId, addressId, addressData) => {
  const { name, phone, addressLine1, addressLine2, city, state, postalCode, country, isDefault } = addressData;

  const address = await prisma.address.findFirst({
    where: {
      id: addressId,
      userId
    }
  });

  if (!address) {
    throw new Error('Address not found');
  }

  // If this is being set as default, unset other defaults
  if (isDefault) {
    await prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false }
    });
  }

  const updatedAddress = await prisma.address.update({
    where: { id: addressId },
    data: {
      ...(name && { name }),
      ...(phone && { phone }),
      ...(addressLine1 && { addressLine1 }),
      ...(addressLine2 !== undefined && { addressLine2 }),
      ...(city && { city }),
      ...(state && { state }),
      ...(postalCode && { postalCode }),
      ...(country && { country }),
      ...(isDefault !== undefined && { isDefault })
    }
  });

  return {
    message: 'Address updated successfully',
    address: updatedAddress
  };
};

// Delete address
const deleteAddress = async (userId, addressId) => {
  const address = await prisma.address.findFirst({
    where: {
      id: addressId,
      userId
    }
  });

  if (!address) {
    throw new Error('Address not found');
  }

  await prisma.address.delete({
    where: { id: addressId }
  });

  return { message: 'Address deleted successfully' };
};

// Set default address
const setDefaultAddress = async (userId, addressId) => {
  const address = await prisma.address.findFirst({
    where: {
      id: addressId,
      userId
    }
  });

  if (!address) {
    throw new Error('Address not found');
  }

  // Unset all other defaults
  await prisma.address.updateMany({
    where: { userId, isDefault: true },
    data: { isDefault: false }
  });

  // Set this one as default
  const updatedAddress = await prisma.address.update({
    where: { id: addressId },
    data: { isDefault: true }
  });

  return {
    message: 'Default address updated successfully',
    address: updatedAddress
  };
};

module.exports = {
  getUserProfile,
  updateProfile,
  updatePhoneNumber,
  getUserAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};
