const jwt = require('jsonwebtoken');
const prisma = require('../../config/prisma');

const getJwtSecret = () => process.env.JWT_SECRET || 'dev-access-secret';

const extractToken = (req) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.accessToken) {
    token = req.cookies.accessToken;
  } else if (req.query.token) {
    token = req.query.token;
  }

  return token;
};

const authenticateRequest = async (req) => {
  const token = extractToken(req);
  if (!token) {
    const error = new Error('Unauthorized: No token provided');
    error.statusCode = 401;
    throw error;
  }

  const decoded = jwt.verify(token, getJwtSecret());

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: {
      id: true,
      is_active: true,
      role: true,
    },
  });

  if (!user) {
    const error = new Error('Unauthorized: User not found');
    error.statusCode = 401;
    throw error;
  }

  return user;
};

const verifyToken = async (req, res, next) => {
  try {
    req.user = await authenticateRequest(req);
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Unauthorized: Token expired' });
    }
    if (error.statusCode === 401) {
      return res.status(401).json({ message: error.message });
    }
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

const verifyAdmin = async (req, res, next) => {
  try {
    req.user = await authenticateRequest(req);

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Unauthorized: Token expired' });
    }
    if (error.statusCode === 401) {
      return res.status(401).json({ message: error.message });
    }
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

module.exports = { 
  verifyToken,
  verifyAdmin
};
