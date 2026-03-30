// test-utils/resetDB.js
const { execSync } = require('child_process');
const path = require('path');

module.exports = function resetDB() {
  execSync(
        'pnpm --filter backend seed',
        {
          stdio: 'inherit',
          cwd: path.resolve(__dirname, '../'),
          env: {
            ...process.env,
            NODE_ENV: 'staging',
          },
        }
      );
      console.log('Database reset and seeded successfully.');
};