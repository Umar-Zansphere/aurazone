require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function seedAdmin() {
  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@aurazone.com' },
  });

  if (existingAdmin) {
    console.log('Admin user already exists');
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash('Admin.aura@2026', 10);

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: 'superadmin@aurazone.shop',
      password: hashedPassword,
      fullName: 'Admin User',
      phone: '8190899870',
      role: 'ADMIN',
      is_active: true,
      is_email_verified: new Date(),
    },
  });

  console.log('Admin user created successfully:', admin.email);
}

seedAdmin()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
  });
