const prisma = require('../../config/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const useragent = require('express-useragent');
const { sendEmail } = require('../../config/email');

const generateTokens = (user) => {
  const roleName = user?.role || null;
  const accessToken = jwt.sign({ id: user.id, role: roleName }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
  return { accessToken };
};

const createSession = async (userId, accessToken, req) => {
  const rawUA = req.headers['user-agent'] || 'Unknown UA';
  const parsedUA = useragent.parse(rawUA);

  // Force to string
  const uaString = `${parsedUA.browser} ${parsedUA.version} / ${parsedUA.os} ${parsedUA.platform}`;

  // Calculate expiration based on JWT_REFRESH_EXPIRES_IN
  const expiresAt = new Date(
    Date.now() + parseInt(process.env.JWT_REFRESH_EXPIRES_IN) * 1000
  );

  return prisma.userSession.create({
    data: {
      userId: userId,
      refreshTokenHash: accessToken, // This is the allowlist entry
      deviceInfo: uaString, // 🔥 always a string
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      expiresAt: expiresAt,
    }
  });
};

const signup = async (email, password) => {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error('Email already in use');
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      is_active: true,
      emailVerificationToken: crypto.randomBytes(32).toString('hex'),
    },
  });

  // send verification email
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${newUser.emailVerificationToken}`;
  await sendEmail(
    newUser.email,
    'Verify Your SoleMate Account',
    'verify-email',
    { user: newUser, verificationUrl }
  );

  return {
    newUser,
    message: 'Signup successful! Please check your email to verify your account.'
  };
};

const login = async (email, password, req) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new Error('Invalid email or password');
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    throw new Error('Invalid password');
  }
  if (user.is_email_verified === null) {
    throw new Error('Please verify your email.');
  }
  const { accessToken } = generateTokens(user);
  // Update last login time
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { last_login_at: new Date() },
  });

  return { accessToken, user: updatedUser };
}

const verifyEmail = async (token) => {
  const user = await prisma.user.findFirst({
    where: { emailVerificationToken: token },
  });

  if (!user) throw new Error('Invalid verification token.');

  // First update the user's verification status
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: null,
      is_email_verified: new Date(),
    },
  });

  return { message: 'Email verified successfully.' };
};

const forgotPassword = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('User not found.');

  const resetToken = crypto.randomBytes(32).toString('hex');
  const passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  const passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.user.update({
    where: { email },
    data: { passwordResetToken, passwordResetExpires },
  });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
  await sendEmail(
    user.email,
    'Reset Your SoleMate Password',
    'reset-password', // <-- Template name
    { user, resetUrl } // <-- Data for the template
  );

  return { message: 'Password reset email sent.' };
};

const resetPassword = async (token, password) => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hashedToken,
      passwordResetExpires: { gt: new Date() },
    },
  });

  if (!user) throw new Error('Invalid or expired token.');

  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  return { message: 'Password reset successfully.' };
};

const changePassword = async (userId, oldPassword, newPassword, req) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || !user.password) {
    throw new Error('User not found or password not set.');
  }

  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) {
    throw new Error('Incorrect old password.');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return { message: 'Password changed successfully.' };
};

const logout = async (userId, accessToken) => {
  if (!accessToken) {
    return { message: 'No session to revoke.' };
  }

  const session = await prisma.userSession.findUnique({
    where: { refreshTokenHash: accessToken }
  });
  if (session) {
    await prisma.userSession.delete({ where: { id: session.id } });

  } else {
    console.log("Logout attempted for a token that was already invalid or expired.");
  }
  return { message: 'Logged out successfully.' };
};

const resendVerification = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('User not found');
  if (user.is_email_verified) throw new Error('Email already verified');

  const token = crypto.randomBytes(32).toString('hex');
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerificationToken: token },
  });

  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  await sendEmail(
    email,
    'Verify Your SoleMate Account',
    'verify-email',
    { user, verificationUrl }
  );
};

// Phone Verification Methods
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // Generate 6-digit OTP
};

const hashOTP = (otp) => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

const sendPhoneVerification = async (userId, phoneNumber, email) => {
  try {
    // Validate email is provided
    if (!email) {
      throw new Error('Email is required to send verification code.');
    }

    // Generate OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp);

    // Set expiration to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Delete any existing active OTP for this phone
    await prisma.otpVerification.deleteMany({
      where: {
        userId,
        phone: phoneNumber,
        verifiedAt: null,
      },
    });

    // Create new OtpVerification record
    await prisma.otpVerification.create({
      data: {
        userId,
        phone: phoneNumber,
        otpHash,
        identifier: 'phone',
        purpose: 'VERIFICATION',
        expiresAt,
      },
    });

    // Send OTP via email
    await sendEmail(
      email,
      'Your SoleMate Verification Code',
      'otp-verification',
      { otp, purpose: 'VERIFICATION' }
    );

    return {
      success: true,
      message: `Verification code sent to ${email}`,
      expiresIn: 600, // 10 minutes in seconds
    };
  } catch (error) {
    console.error('Error sending phone verification OTP:', error);
    throw new Error('Failed to send verification code. Please try again.');
  }
};

const verifyPhoneOtp = async (userId, phoneNumber, otp) => {
  try {
    // Validate OTP format (must be 6 digits)
    if (!/^\d{6}$/.test(otp)) {
      throw new Error('Invalid verification code format.');
    }

    // Hash the provided OTP
    const otpHash = hashOTP(otp);

    // Find the active PhoneVerification record
    const phoneVerification = await prisma.otpVerification.findFirst({
      where: {
        userId,
        phone: phoneNumber,
        verifiedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!phoneVerification) {
      throw new Error('No active verification found for this phone number.');
    }

    // Check if OTP has expired
    if (new Date() > phoneVerification.expiresAt) {
      await prisma.otpVerification.delete({
        where: { id: phoneVerification.id },
      });
      throw new Error('Verification code has expired. Please request a new one.');
    }

    // Verify OTP
    if (otpHash !== phoneVerification.otpHash) {
      throw new Error('Invalid verification code.');
    }

    // OTP is valid - mark as verified and update user's phone
    const now = new Date();
    await prisma.otpVerification.update({
      where: { id: phoneVerification.id },
      data: { verifiedAt: now },
    });

    // Update user's phone number and verification timestamp
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        phone: phoneNumber,
        is_phone_verified: now,
      },
    });

    return {
      success: true,
      message: 'Phone number verified successfully.',
      isPhoneVerified: true,
    };
  } catch (error) {
    console.error('Error verifying phone OTP:', error);
    throw error;
  }
};

const phoneSignup = async (phoneNumber, email) => {
  try {
    // Validate email is provided
    if (!email) {
      throw new Error('Email is required to send verification code.');
    }

    // Check if phone already exists and is verified
    const existingUser = await prisma.user.findFirst({
      where: {
        phone: phoneNumber,
        is_phone_verified: { not: null }
      }
    });

    if (existingUser) {
      throw new Error('Phone number already registered');
    }

    // Generate OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing active OTP for this phone (for signup)
    await prisma.otpVerification.deleteMany({
      where: {
        phone: phoneNumber,
        purpose: 'SIGNUP',
        verifiedAt: null,
      },
    });

    // Create new OTP verification record
    await prisma.otpVerification.create({
      data: {
        phone: phoneNumber,
        otpHash,
        identifier: 'phone',
        purpose: 'SIGNUP',
        expiresAt,
      },
    });

    // Send OTP via email
    await sendEmail(
      email,
      'Your SoleMate Signup Code',
      'otp-verification',
      { otp, purpose: 'SIGNUP' }
    );

    return {
      success: true,
      message: `Verification code sent to ${email}`,
      expiresIn: 600, // 10 minutes in seconds
    };
  } catch (error) {
    console.error('Error sending phone signup OTP:', error);
    throw error;
  }
};

const phoneSignupVerify = async (phoneNumber, otp) => {
  try {
    // Validate OTP format
    if (!/^\d{6}$/.test(otp)) {
      throw new Error('Invalid verification code format.');
    }

    const otpHash = hashOTP(otp);

    // Find the active OTP verification record
    const otpVerification = await prisma.otpVerification.findFirst({
      where: {
        phone: phoneNumber,
        purpose: 'SIGNUP',
        verifiedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpVerification) {
      throw new Error('No active signup verification found for this phone number.');
    }

    // Check if OTP has expired
    if (new Date() > otpVerification.expiresAt) {
      throw new Error('Verification code has expired. Please request a new one.');
    }

    // Verify OTP
    if (otpHash !== otpVerification.otpHash) {
      throw new Error('Invalid verification code.');
    }

    // Mark OTP as verified
    const now = new Date();
    await prisma.otpVerification.update({
      where: { id: otpVerification.id },
      data: { verifiedAt: now },
    });

    // Check if user already exists with this phone
    let user = await prisma.user.findFirst({
      where: {
        phone: phoneNumber,
      }
    });

    // If user doesn't exist, create a new one
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone: phoneNumber,
          is_phone_verified: now,
          is_active: true,
          is_email_verified: null,
        },
      });
    } else {
      // Update existing user with phone verification
      user = await prisma.user.update({
        where: { id: user.id },
        data: { is_phone_verified: now },
      });
    }

    // Mark OTP as verified AND link it to the User ID
    await prisma.otpVerification.update({
      where: { id: otpVerification.id },
      data: {
        verifiedAt: now,
        userId: user.id // Link the OTP record to the created/found user
      },
    });

    // Generate tokens
    const { accessToken } = generateTokens(user);

    return {
      success: true,
      message: 'Phone verified successfully. Account created.',
      accessToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        userRole: user.role,
        phone: user.phone,
        email: user.email,
        is_phone_verified: user.is_phone_verified,
      }
    };
  } catch (error) {
    console.error('Error verifying phone signup OTP:', error);
    throw error;
  }
};

const phoneLogin = async (phoneNumber) => {
  try {
    // Check if user exists with this phone and it's verified
    const user = await prisma.user.findFirst({
      where: {
        phone: phoneNumber,
        is_phone_verified: { not: null }
      }
    });

    if (!user) {
      throw new Error('Phone number not registered. Please sign up first.');
    }

    // Check if user has email
    if (!user.email) {
      throw new Error('Email is required to send verification code. Please update your profile.');
    }

    // Generate OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing active OTP for this phone (for login)
    await prisma.otpVerification.deleteMany({
      where: {
        phone: phoneNumber,
        userId: user.id,
        purpose: 'LOGIN',
        verifiedAt: null,
      },
    });

    // Create new OTP verification record
    await prisma.otpVerification.create({
      data: {
        userId: user.id,
        phone: phoneNumber,
        otpHash,
        identifier: 'phone',
        purpose: 'LOGIN',
        expiresAt,
      },
    });

    // Send OTP via email
    await sendEmail(
      user.email,
      'Your SoleMate Login Code',
      'otp-verification',
      { otp, purpose: 'LOGIN' }
    );

    return {
      success: true,
      message: `Verification code sent to ${user.email}`,
      expiresIn: 600, // 10 minutes in seconds
    };
  } catch (error) {
    console.error('Error sending phone login OTP:', error);
    throw error;
  }
};

const phoneLoginVerify = async (phoneNumber, otp, req) => {
  try {
    // Validate OTP format
    if (!/^\d{6}$/.test(otp)) {
      throw new Error('Invalid verification code format.');
    }

    const otpHash = hashOTP(otp);

    // Find user by phone
    const user = await prisma.user.findFirst({
      where: {
        phone: phoneNumber,
        is_phone_verified: { not: null }
      }
    });

    if (!user) {
      throw new Error('Invalid phone number.');
    }

    // Find the active OTP verification record
    const otpVerification = await prisma.otpVerification.findFirst({
      where: {
        userId: user.id,
        phone: phoneNumber,
        purpose: 'LOGIN',
        verifiedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpVerification) {
      throw new Error('No active login verification found for this phone number.');
    }

    // Check if OTP has expired
    if (new Date() > otpVerification.expiresAt) {
      throw new Error('Verification code has expired. Please request a new one.');
    }

    // Verify OTP
    if (otpHash !== otpVerification.otpHash) {
      throw new Error('Invalid verification code.');
    }

    // Mark OTP as verified
    const now = new Date();
    await prisma.otpVerification.update({
      where: { id: otpVerification.id },
      data: { verifiedAt: now },
    });

    // Generate tokens and create session
    const { accessToken } = generateTokens(user);
    // const session = await createSession(user.id, accessToken, req);

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: now },
    });

    return {
      success: true,
      message: 'Login successful.',
      accessToken,
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        userRole: user.role,
        is_phone_verified: user.is_phone_verified,
        email: user.email,
      }
    };
  } catch (error) {
    console.error('Error verifying phone login OTP:', error);
    throw error;
  }
};

module.exports = {
  generateTokens,
  createSession,
  signup,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  logout,
  resendVerification,
  sendPhoneVerification,
  verifyPhoneOtp,
  phoneSignup,
  phoneSignupVerify,
  phoneLogin,
  phoneLoginVerify
};