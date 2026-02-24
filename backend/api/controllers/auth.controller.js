const authService = require('../services/auth.services');

// signup controller
const signup = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.signup(email, password);
    res.status(201).json({ message: result.message });
  } catch (error) {
      next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;
    const result = await authService.verifyEmail(token);
    res.json(result);
  } catch (error) {
    next(error)
  }
};

const resendVerification = async (req, res, next) => {
  try {
    await authService.resendVerification(req.body.email);
    res.json({ message: 'Verification email sent successfully' });
  } catch (error) {
    next(error)
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password, req);
    const user = result.user;
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true, 
      secure: true,
      sameSite: 'none', 
      maxAge: 7 * 24 * 60 * 60 * 1000, 
    });
    // Send back user data (excluding sensitive fields) along with the token
    const userData = {
      id: user.id,
      fullName: user.fullName,
      userRole: user.role,
      email: user.email,
      phone: user.phone,
    };
    
    res.json({ user: userData });
  } catch (error) {
      next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const result = await authService.forgotPassword(req.body.email);
    res.json(result);
  } catch (error) {
      next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const result = await authService.resetPassword(token, password);
    res.json(result);
  } catch (error) {
    next(error);
  }
};


const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user.id, oldPassword, newPassword, req);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    // Get the refresh token from the cookie
    const accessToken = req.cookies.accessToken;
    console.log("Logging out user:", req.user.id);
    // await authService.logout(req.user.id, accessToken);
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/' 
    });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error)
  }
};

const sendPhoneVerification = async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;
    const userId = req.user.id;

    // Validate phone number format (basic validation)
    if (!phoneNumber || phoneNumber.trim().length < 10) {
      return res.status(400).json({ message: 'Invalid phone number format.' });
    }
    const result = await authService.sendPhoneVerification(userId, phoneNumber);
    res.json(result);
  } catch (error) {
    next(error)
  }
};

const verifyPhoneOtp = async (req, res, next) => {
  try {
    const { phoneNumber, otp } = req.body;
    const userId = req.user.id;

    // Validate inputs
    if (!phoneNumber || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required.' });
    }

    const result = await authService.verifyPhoneOtp(userId, phoneNumber, otp);
    res.json(result);
  } catch (error) {
    next(error)
  }
};

const phoneSignup = async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;

    // Validate phone number
    if (!phoneNumber || phoneNumber.trim().length < 10) {
      return res.status(400).json({ message: 'Invalid phone number format.' });
    }

    const result = await authService.phoneSignup(phoneNumber);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const phoneSignupVerify = async (req, res, next) => {
  try {
    const { phoneNumber, otp } = req.body;

    // Validate inputs
    if (!phoneNumber || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required.' });
    }

    const result = await authService.phoneSignupVerify(phoneNumber, otp);
    
    // Set cookies for tokens
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.status(201).json({
      message: result.message,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
};

const phoneLogin = async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;

    // Validate phone number
    if (!phoneNumber || phoneNumber.trim().length < 10) {
      return res.status(400).json({ message: 'Invalid phone number format.' });
    }

    const result = await authService.phoneLogin(phoneNumber);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const phoneLoginVerify = async (req, res, next) => {
  try {
    const { phoneNumber, otp } = req.body;

    // Validate inputs
    if (!phoneNumber || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required.' });
    }

    const result = await authService.phoneLoginVerify(phoneNumber, otp, req);

    // Set cookies for tokens
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });
    const userData = {
      id: result.user.id,
      phone: result.user.phone,
      fullName: result.user.fullName,
      userRole: result.user.userRole,
      email: result.user.email,
      phone: result.user.phone,
    };

    res.json({ user: userData, message: result.message });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
  verifyEmail,
  resendVerification,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  logout,
  sendPhoneVerification,
  verifyPhoneOtp,
  phoneSignup,
  phoneSignupVerify,
  phoneLogin,
  phoneLoginVerify
};