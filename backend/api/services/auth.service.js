const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = require('../../config/prisma');
const { createError } = require('../../utils/error');

const getCookieOptions = () => ({
  httpOnly: true,
  secure: true,
  sameSite: 'none',
});

const getJwtSecret = () => process.env.JWT_SECRET;

const signAccessToken = (payload) => {
  const expiresIn = process.env.JWT_EXPIRES_IN;
  return jwt.sign(payload, getJwtSecret(), { expiresIn });
};

const login = async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    throw createError(400, 'email and password are required');
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      password: true,
      is_active: true,
    },
  });

  if (!user || !user.password) {
    throw createError(401, 'Invalid email or password');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw createError(401, 'Invalid email or password');
  }

  const accessToken = signAccessToken({ id: user.id, role: user.role });

  res.cookie('accessToken', accessToken, {
    ...getCookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      is_active: true,
      isGuest: false,
      last_login_at: new Date(),
    },
  });

  return res.status(200).json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
  });
};

const logout = async (req, res) => {
  res.clearCookie('accessToken', getCookieOptions());

  return res.status(200).json({
    message: 'Logged out successfully',
  });
};

module.exports = {
  login,
  logout,
};
