// Custom error class to include status code
class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const makeRequest = async (url, options = {}) => {

  const response = await fetch(`${url}`, {
    headers: {
      'ngrok-skip-browser-warning': 'true',
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  // Handle 401 Unauthorized - user not authenticated
  if (response.status === 401) {
    const error = new ApiError('Unauthorized', 401);
    throw error;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(error.message || `API error: ${response.status}`, response.status, error);
  }

  return response.json();
};

export const authApi = {
  // Phone Auth
  phoneLogin: (phoneNumber) =>
    fetch(`/api/auth/phone-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true', },
      body: JSON.stringify({ phoneNumber }),
    }),

  phoneLoginVerify: (phoneNumber, otp) =>
    fetch(`/api/auth/phone-login-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ phoneNumber, otp }),
    }),

  phoneSignup: (phoneNumber) =>
    fetch(`/api/auth/phone-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ phoneNumber }),
    }),

  phoneSignupVerify: (phoneNumber, otp) =>
    fetch(`/api/auth/phone-signup-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ phoneNumber, otp }),
    }),

  // Email Auth
  login: (email, password) =>
    fetch(`/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ email, password }),
    }),

  signup: (email, password) =>
    fetch(`/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ email, password }),
    }),

  verifyEmail: (token) =>
    fetch(`/api/auth/verify-email`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      params: { token },
    }),

  logout: () =>
    fetch(`/api/auth/logout`, {
      method: 'POST',
      headers: { 'ngrok-skip-browser-warning': 'true' },
      credentials: 'include',
    }),

  forgotPassword: (email) =>
    fetch(`/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ email }),
    }),
};

// Product API - Customer facing endpoints
export const productApi = {
  // Get filter options
  getFilterOptions: () => makeRequest('/api/products/filters/options'),

  // Get popular/featured products
  getPopularProducts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return makeRequest(`/api/products/popular${query ? '?' + query : ''}`);
  },

  // Get products by brand
  getProductsByBrand: (brandName, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return makeRequest(`/api/products/brand/${encodeURIComponent(brandName)}${query ? '?' + query : ''}`);
  },

  // Get products by category
  getProductsByCategory: (categoryName, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return makeRequest(`/api/products/category/${encodeURIComponent(categoryName)}${query ? '?' + query : ''}`);
  },

  // Get products by gender
  getProductsByGender: (genderName, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return makeRequest(`/api/products/gender/${encodeURIComponent(genderName)}${query ? '?' + query : ''}`);
  },

  // Get products by color
  getProductsByColor: (colorName, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return makeRequest(`/api/products/color/${encodeURIComponent(colorName)}${query ? '?' + query : ''}`);
  },

  // Get products by size
  getProductsBySize: (sizeValue, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return makeRequest(`/api/products/size/${encodeURIComponent(sizeValue)}${query ? '?' + query : ''}`);
  },

  // Get products by model number
  getProductsByModel: (modelNumber, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return makeRequest(`/api/products/model/${encodeURIComponent(modelNumber)}${query ? '?' + query : ''}`);
  },

  // Search products with advanced filters
  searchProducts: (filters = {}) => {
    const query = new URLSearchParams(filters).toString();
    return makeRequest(`/api/products/search${query ? '?' + query : ''}`);
  },

  // Get products list with optional filters
  getProducts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return makeRequest(`/api/products${query ? '?' + query : ''}`);
  },

  // Get single product detail
  getProductDetail: (productId) => {
    return makeRequest(`/api/products/${productId}`);
  },
};

// Cart API
export const cartApi = {
  getCart: () => makeRequest('/api/cart'),

  addToCart: (variantId, quantity = 1) =>
    makeRequest('/api/cart', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ variantId, quantity }),
    }),

  removeFromCart: (cartItemId) =>
    makeRequest(`/api/cart/${cartItemId}`, {
      method: 'DELETE',
      credentials: 'include',
    }),

  updateCartItem: (cartItemId, quantity) =>
    makeRequest(`/api/cart/${cartItemId}`, {
      method: 'PATCH',
      credentials: 'include',
      body: JSON.stringify({ quantity }),

    }),
};

// Wishlist API
export const wishlistApi = {
  getWishlist: () => makeRequest('/api/wishlist'),

  addToWishlist: (productId, variantId = null) =>
    makeRequest('/api/wishlist', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ productId, variantId }),
    }),

  removeFromWishlist: (wishlistItemId) =>
    makeRequest(`/api/wishlist/${wishlistItemId}`, {
      method: 'DELETE',
      credentials: 'include',
    }),

  moveToCart: (wishlistItemId) =>
    makeRequest(`/api/wishlist/${wishlistItemId}/move-to-cart`, {
    }),
};

// Order API - Customer-facing order endpoints
export const orderApi = {
  // Create order from cart (checkout)
  createOrder: async (addressId, paymentMethod) => {
    return makeRequest('/api/orders', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ addressId, paymentMethod })
    });
  },

  // Create guest order with address data
  createGuestOrder: async (addressData, paymentMethod) => {
    return makeRequest('/api/orders', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ address: addressData, paymentMethod })
    });
  },

  // Get all orders for user
  getOrders: async (status = null, skip = 0, take = 10) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('skip', skip);
    params.append('take', take);

    return makeRequest(`/api/orders?${params.toString()}`, {
      credentials: 'include',
    });
  },

  // Get order detail
  getOrderDetail: async (orderId) => {
    return makeRequest(`/api/orders/${orderId}`, {
      credentials: 'include',
    });
  },

  // Track order
  trackOrder: async (orderId) => {
    return makeRequest(`/api/orders/${orderId}/track`, {
      credentials: 'include',
    });
  },

  // Cancel order
  cancelOrder: async (orderId, reason = '') => {
    return makeRequest(`/api/orders/${orderId}/cancel`, {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ reason })
    });
  },

  // Track order by tracking token (public - no auth required)
  trackOrderByToken: async (trackingToken) => {
    return makeRequest(`/api/orders/track/${trackingToken}`, {
      method: 'GET',
    });
  },
};

// User API - Profile and account management
export const userApi = {
  // Get user profile
  getProfile: async () => {
    return makeRequest('/api/users/profile', {
      credentials: 'include',
    });
  },

  // Update profile (fullName, email)
  updateProfile: async (fullName, email) => {
    return makeRequest('/api/users/profile', {
      method: 'PUT',
      credentials: 'include',
      body: JSON.stringify({ fullName, email })
    });
  },

  // Update phone number
  updatePhoneNumber: async (phoneNumber) => {
    return makeRequest('/api/users/phone', {
      method: 'PUT',
      credentials: 'include',
      body: JSON.stringify({ phoneNumber })
    });
  }
};

// Address API - Delivery address management
export const addressApi = {
  // Get all addresses
  getAddresses: async () => {
    return makeRequest('/api/users/addresses', {
      credentials: 'include',
    });
  },

  // Get single address
  getAddressById: async (addressId) => {
    return makeRequest(`/api/users/addresses/${addressId}`, {
      credentials: 'include',
    });
  },

  // Create address
  createAddress: async (addressData) => {
    return makeRequest('/api/users/addresses', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(addressData)
    });
  },

  // Update address
  updateAddress: async (addressId, addressData) => {
    return makeRequest(`/api/users/addresses/${addressId}`, {
      method: 'PUT',
      credentials: 'include',
      body: JSON.stringify(addressData)
    });
  },

  // Delete address
  deleteAddress: async (addressId) => {
    return makeRequest(`/api/users/addresses/${addressId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
  },

  // Set default address
  setDefaultAddress: async (addressId) => {
    return makeRequest(`/api/users/addresses/${addressId}/default`, {
      method: 'PATCH',
      credentials: 'include'
    });
  }
};

// Payment API
export const paymentApi = {
  // Verify Razorpay payment
  verifyPayment: async (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
    return makeRequest('/api/orders/payment/verify', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      })
    });
  }
};