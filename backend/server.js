const dotenv = require('dotenv');

// 🔥 Load correct env file
dotenv.config({
  path: process.env.NODE_ENV === 'staging'
    ? '.env.staging'
    : '.env'
});

const { app } = require('./app');
const adminService = require('./api/services/admin.service');

const PORT = process.env.PORT || 5000;

adminService.initializeBulkProductWorker();

app.listen(PORT, () => {
  console.log(`Server running on Port: ${PORT}`);
  console.log(`ENV: ${process.env.NODE_ENV}`);
});
