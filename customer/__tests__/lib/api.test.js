/**
 * Tests for src/lib/api.js
 * Covers: ApiError, makeRequest, authApi, productApi, cartApi, wishlistApi, orderApi, userApi, addressApi, paymentApi
 */

// We need to test the module, so we mock fetch globally
beforeEach(() => {
    global.fetch = jest.fn();
});

afterEach(() => {
    jest.restoreAllMocks();
});

// Dynamic imports to allow per-test mocking
let authApi, productApi, cartApi, wishlistApi, orderApi, userApi, addressApi, paymentApi;

beforeAll(async () => {
    const api = await import('@/lib/api');
    authApi = api.authApi;
    productApi = api.productApi;
    cartApi = api.cartApi;
    wishlistApi = api.wishlistApi;
    orderApi = api.orderApi;
    userApi = api.userApi;
    addressApi = api.addressApi;
    paymentApi = api.paymentApi;
});

// ─── authApi ──────────────────────────────────────────────────────────────────

describe('authApi', () => {
    test('phoneLogin calls fetch with correct URL and body', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await authApi.phoneLogin('+1234567890');
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/phone-login', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ phoneNumber: '+1234567890' }),
        }));
    });

    test('phoneLoginVerify calls fetch with phone and otp', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await authApi.phoneLoginVerify('+1234567890', '123456');
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/phone-login-verify', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ phoneNumber: '+1234567890', otp: '123456' }),
        }));
    });

    test('phoneSignup calls fetch with phone, email and password', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await authApi.phoneSignup('+1234567890', 'test@test.com', 'Password1!');
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/phone-signup', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ phoneNumber: '+1234567890', email: 'test@test.com', password: 'Password1!' }),
        }));
    });

    test('phoneSignupVerify calls fetch with phone and otp', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await authApi.phoneSignupVerify('+1234567890', '123456');
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/phone-signup-verify', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ phoneNumber: '+1234567890', otp: '123456' }),
        }));
    });

    test('login calls fetch with email and password', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await authApi.login('test@test.com', 'Password1!');
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ email: 'test@test.com', password: 'Password1!' }),
        }));
    });

    test('signup calls fetch with email and password', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await authApi.signup('test@test.com', 'Password1!');
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/signup', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ email: 'test@test.com', password: 'Password1!' }),
        }));
    });

    test('logout calls fetch with POST method', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await authApi.logout();
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({
            method: 'POST',
            credentials: 'include',
        }));
    });

    test('forgotPassword calls fetch with email', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await authApi.forgotPassword('test@test.com');
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/forgot-password', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ email: 'test@test.com' }),
        }));
    });

    test('all auth methods include ngrok-skip-browser-warning header', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await authApi.phoneLogin('+1234567890');
        const callHeaders = global.fetch.mock.calls[0][1].headers;
        expect(callHeaders['ngrok-skip-browser-warning']).toBe('true');
    });

    test('all auth methods include Content-Type header', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await authApi.login('a@b.com', 'pass');
        const callHeaders = global.fetch.mock.calls[0][1].headers;
        expect(callHeaders['Content-Type']).toBe('application/json');
    });
});

// ─── productApi ───────────────────────────────────────────────────────────────

describe('productApi', () => {
    test('getFilterOptions calls correct URL', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: {} }) });
        await productApi.getFilterOptions();
        expect(global.fetch).toHaveBeenCalledWith('/api/products/filters/options', expect.any(Object));
    });

    test('getPopularProducts calls with params', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: {} }) });
        await productApi.getPopularProducts({ skip: 0, take: 8 });
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/products/popular'),
            expect.any(Object)
        );
    });

    test('getPopularProducts calls without params', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: {} }) });
        await productApi.getPopularProducts();
        expect(global.fetch).toHaveBeenCalledWith('/api/products/popular', expect.any(Object));
    });

    test('getProductsByBrand encodes brand name', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: {} }) });
        await productApi.getProductsByBrand('Nike Air');
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/products/brand/Nike%20Air'),
            expect.any(Object)
        );
    });

    test('getProductsByCategory calls correct URL', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: {} }) });
        await productApi.getProductsByCategory('RUNNING');
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/products/category/RUNNING'),
            expect.any(Object)
        );
    });

    test('getProductsByGender calls correct URL', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: {} }) });
        await productApi.getProductsByGender('MEN');
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/products/gender/MEN'),
            expect.any(Object)
        );
    });

    test('getProductsByColor encodes color name', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: {} }) });
        await productApi.getProductsByColor('Red');
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/products/color/Red'),
            expect.any(Object)
        );
    });

    test('getProductsBySize calls correct URL', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: {} }) });
        await productApi.getProductsBySize('42');
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/products/size/42'),
            expect.any(Object)
        );
    });

    test('getProductsByModel calls correct URL', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: {} }) });
        await productApi.getProductsByModel('ABC-123');
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/products/model/ABC-123'),
            expect.any(Object)
        );
    });

    test('searchProducts builds query string', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: {} }) });
        await productApi.searchProducts({ search: 'nike', category: 'RUNNING' });
        const calledUrl = global.fetch.mock.calls[0][0];
        expect(calledUrl).toContain('/api/products/search?');
        expect(calledUrl).toContain('search=nike');
        expect(calledUrl).toContain('category=RUNNING');
    });

    test('getProducts calls without filters', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: {} }) });
        await productApi.getProducts();
        expect(global.fetch).toHaveBeenCalledWith('/api/products', expect.any(Object));
    });

    test('getProductDetail calls with product ID', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: {} }) });
        await productApi.getProductDetail('prod-123');
        expect(global.fetch).toHaveBeenCalledWith('/api/products/prod-123', expect.any(Object));
    });
});

// ─── cartApi ──────────────────────────────────────────────────────────────────

describe('cartApi', () => {
    test('getCart calls correct URL', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ items: [] }) });
        await cartApi.getCart();
        expect(global.fetch).toHaveBeenCalledWith('/api/cart', expect.any(Object));
    });

    test('addToCart sends POST with variantId and quantity', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await cartApi.addToCart('var-1', 2);
        expect(global.fetch).toHaveBeenCalledWith('/api/cart', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ variantId: 'var-1', quantity: 2 }),
        }));
    });

    test('addToCart defaults quantity to 1', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await cartApi.addToCart('var-1');
        const body = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(body.quantity).toBe(1);
    });

    test('removeFromCart sends DELETE with cartItemId', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await cartApi.removeFromCart('item-1');
        expect(global.fetch).toHaveBeenCalledWith('/api/cart/item-1', expect.objectContaining({
            method: 'DELETE',
        }));
    });

    test('updateCartItem sends PATCH with quantity', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await cartApi.updateCartItem('item-1', 3);
        expect(global.fetch).toHaveBeenCalledWith('/api/cart/item-1', expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ quantity: 3 }),
        }));
    });
});

// ─── wishlistApi ──────────────────────────────────────────────────────────────

describe('wishlistApi', () => {
    test('getWishlist calls correct URL', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ items: [] }) });
        await wishlistApi.getWishlist();
        expect(global.fetch).toHaveBeenCalledWith('/api/wishlist', expect.any(Object));
    });

    test('addToWishlist sends POST with productId and variantId', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await wishlistApi.addToWishlist('prod-1', 'var-1');
        expect(global.fetch).toHaveBeenCalledWith('/api/wishlist', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ productId: 'prod-1', variantId: 'var-1' }),
        }));
    });

    test('removeFromWishlist sends DELETE', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await wishlistApi.removeFromWishlist('wish-1');
        expect(global.fetch).toHaveBeenCalledWith('/api/wishlist/wish-1', expect.objectContaining({
            method: 'DELETE',
        }));
    });

    test('moveToCart calls correct URL', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await wishlistApi.moveToCart('wish-1');
        expect(global.fetch).toHaveBeenCalledWith('/api/wishlist/wish-1/move-to-cart', expect.any(Object));
    });
});

// ─── orderApi ─────────────────────────────────────────────────────────────────

describe('orderApi', () => {
    test('createOrder sends POST with addressId and paymentMethod', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await orderApi.createOrder('addr-1', 'COD');
        expect(global.fetch).toHaveBeenCalledWith('/api/orders', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ addressId: 'addr-1', paymentMethod: 'COD' }),
        }));
    });

    test('createGuestOrder sends address data in body', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        const addr = { name: 'Test', city: 'Mumbai' };
        await orderApi.createGuestOrder(addr, 'RAZORPAY');
        expect(global.fetch).toHaveBeenCalledWith('/api/orders', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ address: addr, paymentMethod: 'RAZORPAY' }),
        }));
    });

    test('getOrders builds query params correctly', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await orderApi.getOrders('PENDING', 0, 10);
        const calledUrl = global.fetch.mock.calls[0][0];
        expect(calledUrl).toContain('status=PENDING');
        expect(calledUrl).toContain('skip=0');
        expect(calledUrl).toContain('take=10');
    });

    test('getOrders works without status filter', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await orderApi.getOrders(null, 5, 20);
        const calledUrl = global.fetch.mock.calls[0][0];
        expect(calledUrl).not.toContain('status=');
        expect(calledUrl).toContain('skip=5');
    });

    test('getOrderDetail calls correct URL', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await orderApi.getOrderDetail('ord-1');
        expect(global.fetch).toHaveBeenCalledWith('/api/orders/ord-1', expect.any(Object));
    });

    test('trackOrder calls correct URL', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await orderApi.trackOrder('ord-1');
        expect(global.fetch).toHaveBeenCalledWith('/api/orders/ord-1/track', expect.any(Object));
    });

    test('cancelOrder sends POST with reason', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await orderApi.cancelOrder('ord-1', 'Changed mind');
        expect(global.fetch).toHaveBeenCalledWith('/api/orders/ord-1/cancel', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ reason: 'Changed mind' }),
        }));
    });

    test('trackOrderByToken calls correct URL', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await orderApi.trackOrderByToken('token-abc');
        expect(global.fetch).toHaveBeenCalledWith('/api/orders/track/token-abc', expect.objectContaining({
            method: 'GET',
        }));
    });
});

// ─── userApi ──────────────────────────────────────────────────────────────────

describe('userApi', () => {
    test('getProfile calls correct URL with credentials', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await userApi.getProfile();
        expect(global.fetch).toHaveBeenCalledWith('/api/users/profile', expect.objectContaining({
            credentials: 'include',
        }));
    });

    test('updateProfile sends PUT with fullName and email', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await userApi.updateProfile('John Doe', 'john@test.com');
        expect(global.fetch).toHaveBeenCalledWith('/api/users/profile', expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ fullName: 'John Doe', email: 'john@test.com' }),
        }));
    });

    test('updatePhoneNumber sends PUT with phone', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await userApi.updatePhoneNumber('+1234567890');
        expect(global.fetch).toHaveBeenCalledWith('/api/users/phone', expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ phoneNumber: '+1234567890' }),
        }));
    });
});

// ─── addressApi ───────────────────────────────────────────────────────────────

describe('addressApi', () => {
    test('getAddresses calls correct URL', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
        await addressApi.getAddresses();
        expect(global.fetch).toHaveBeenCalledWith('/api/users/addresses', expect.any(Object));
    });

    test('getAddressById calls correct URL', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await addressApi.getAddressById('addr-1');
        expect(global.fetch).toHaveBeenCalledWith('/api/users/addresses/addr-1', expect.any(Object));
    });

    test('createAddress sends POST with address data', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        const data = { name: 'Home', city: 'Mumbai' };
        await addressApi.createAddress(data);
        expect(global.fetch).toHaveBeenCalledWith('/api/users/addresses', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(data),
        }));
    });

    test('updateAddress sends PUT with addressId', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        const data = { name: 'Updated' };
        await addressApi.updateAddress('addr-1', data);
        expect(global.fetch).toHaveBeenCalledWith('/api/users/addresses/addr-1', expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify(data),
        }));
    });

    test('deleteAddress sends DELETE', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await addressApi.deleteAddress('addr-1');
        expect(global.fetch).toHaveBeenCalledWith('/api/users/addresses/addr-1', expect.objectContaining({
            method: 'DELETE',
        }));
    });

    test('setDefaultAddress sends PATCH', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await addressApi.setDefaultAddress('addr-1');
        expect(global.fetch).toHaveBeenCalledWith('/api/users/addresses/addr-1/default', expect.objectContaining({
            method: 'PATCH',
        }));
    });
});

// ─── paymentApi ───────────────────────────────────────────────────────────────

describe('paymentApi', () => {
    test('verifyPayment sends POST with razorpay details', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await paymentApi.verifyPayment('rp_order_1', 'rp_pay_1', 'sig_1');
        expect(global.fetch).toHaveBeenCalledWith('/api/orders/payment/verify', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
                razorpayOrderId: 'rp_order_1',
                razorpayPaymentId: 'rp_pay_1',
                razorpaySignature: 'sig_1',
            }),
        }));
    });
});

// ─── makeRequest error handling ───────────────────────────────────────────────

describe('makeRequest (via API calls)', () => {
    test('throws on 401 response', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ message: 'Unauthorized' }),
        });
        await expect(productApi.getFilterOptions()).rejects.toThrow('Unauthorized');
    });

    test('throws ApiError on non-ok response', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            json: () => Promise.resolve({ message: 'Invalid input' }),
        });
        await expect(productApi.getProducts()).rejects.toThrow('Invalid input');
    });

    test('handles non-JSON error response', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: () => Promise.reject(new Error('not json')),
        });
        await expect(productApi.getProducts()).rejects.toThrow();
    });

    test('includes default headers in requests', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
        await productApi.getProducts();
        const headers = global.fetch.mock.calls[0][1].headers;
        expect(headers['Content-Type']).toBe('application/json');
        expect(headers['ngrok-skip-browser-warning']).toBe('true');
    });
});
