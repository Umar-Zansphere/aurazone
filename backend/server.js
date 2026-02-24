const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const notificationService = require('./api/services/notification.service');
const prisma = require('./config/prisma.js');

dotenv.config();

const app = express();
app.set("trust proxy", 1); // Trust first proxy
console.log("CLIENT_URL =", process.env.CLIENT_URL);
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://shoe-shop-25gx.vercel.app",
    "https://shoe-shop-8tbmbxp8p-umar-mohameds-projects-5295067c.vercel.app"
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(cookieParser());

// Initialize web-push service
notificationService.initializeWebPush();

// Import routes
const apiRoutes = require("./api/routes/index.js");

// Mount API routes
app.use("/api", apiRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Something broke!';
  res.status(statusCode).json({ message });
});

app.get("/health", async (req, res) => {
  try {
    
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "healthy", message: "Database connection OK ✅" });
  } catch (error) {
    res.status(503).json({ status: "unhealthy", message: "Database connection failed ❌", error: error.message });
  }
});

app.get("/", (req, res) => {
  res.json({ message: "Backend running 🟢" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on Port: ${PORT}`);
});
