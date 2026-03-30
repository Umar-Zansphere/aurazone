// test-utils/resetDB.js
const { execSync } = require('child_process');
const path = require('path');

module.exports = function resetDB() {
  try {
    console.log('📦 Resetting DB...');
    
    execSync('pnpm --filter backend seed', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../../../'),
      env: {
        ...process.env,
        NODE_ENV: 'staging',
      },
    });

    console.log('✅ Database reset and seeded successfully.');
  } catch (err) {
    console.error('❌ Failed to reset/seed database');
    process.exit(1); // 🔥 ensures CI fails immediately
  }
};