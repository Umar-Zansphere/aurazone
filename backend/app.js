const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const notificationService = require('./api/services/notification.service');
const prisma = require('./config/prisma');
const apiRoutes = require('./api/routes/index.js');

const createApp = () => {
  const app = express();

  app.set('trust proxy', 1);
  app.use(cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://shoe-shop-25gx.vercel.app',
      'https://shoe-shop-8tbmbxp8p-umar-mohameds-projects-5295067c.vercel.app',
    ],
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  notificationService.initializeWebPush();

  app.use('/api', apiRoutes);

  app.use((err, req, res, next) => {
    console.error('Error:', err);
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Something broke!';
    res.status(statusCode).json({ message });
  });

  app.get('/health', async (req, res) => {
    try {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'healthy', message: 'Database connection OK ✅' });
    } catch (error) {
      res.status(503).json({ status: 'unhealthy', message: 'Database connection failed ❌', error: error.message });
    }
  });

  app.get('/', (req, res) => {
    res.json({ message: 'Backend running 🟢' });
  });

  return app;
};

const app = createApp();

module.exports = { app, createApp };
