const dotenv = require('dotenv');

// 🔥 Load correct env file
dotenv.config({
  path: process.env.NODE_ENV === 'staging'
    ? '.env.staging'
    : '.env'
});

const { app } = require('./app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on Port: ${PORT}`);
  console.log(`ENV: ${process.env.NODE_ENV}`);
});