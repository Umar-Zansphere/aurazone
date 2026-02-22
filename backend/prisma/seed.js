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

async function main() {
  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@aurazone.com' },
  });

  if (existingAdmin) {
    console.log('Admin user already exists');
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash('Admin@123456', 10);

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: 'admin@aurazone.com',
      password: hashedPassword,
      fullName: 'Admin User',
      phone: '9442442233',
      role: 'ADMIN',
      is_active: true,
      is_email_verified: new Date(),
    },
  });

  console.log('Admin user created successfully:', admin.email);
}

const products = [
  {
    name: 'Urban Street',
    brand: 'Nike',
    category: 'CASUAL',
    gender: 'MEN',
    description: 'Versatile and stylish, the Urban Street sneaker is perfect for everyday wear. Featuring a durable sole and premium materials for maximum comfort.',
    shortDescription: 'Everyday casual sneaker',
    tags: ['lifestyle', 'streetwear', 'casual'],
    variants: [
      {
        size: 'US 9',
        color: 'Midnight Black',
        sku: 'NK-URB-BLK-9',
        price: 110,
        quantity: 50,
        images: [
          'https://images.unsplash.com/photo-1585063395665-b8ad4acbb9af?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDV8fHxlbnwwfHx8fHw%3D',
          'https://media.istockphoto.com/id/2243071703/photo/sneakers-on-background-top-view.webp?a=1&b=1&s=612x612&w=0&k=20&c=E--L4aeBt0IlaWsNakzdwmkaytDNXy-85Bht-99exA4='
        ]
      },
      {
        size: 'US 10',
        color: 'Midnight Black',
        sku: 'NK-URB-BLK-10',
        price: 110,
        quantity: 30,
        images: [
          'https://images.unsplash.com/photo-1585063395665-b8ad4acbb9af?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDV8fHxlbnwwfHx8fHw%3D',
          'https://media.istockphoto.com/id/2243071703/photo/sneakers-on-background-top-view.webp?a=1&b=1&s=612x612&w=0&k=20&c=E--L4aeBt0IlaWsNakzdwmkaytDNXy-85Bht-99exA4='
        ]
      },
      {
        size: 'US 9',
        color: 'Classic White',
        sku: 'NK-URB-WHT-9',
        price: 110,
        quantity: 45,
        images: [
          'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8c2hvZXxlbnwwfHwwfHx8MA%3D%3D',
          'https://plus.unsplash.com/premium_photo-1770646143936-6e64df320e24?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDR8fHxlbnwwfHx8fHw%3D'
        ]
      },
      {
        size: 'US 10',
        color: 'Classic White',
        sku: 'NK-URB-WHT-10',
        price: 110,
        quantity: 40,
        images: [
          'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8c2hvZXxlbnwwfHwwfHx8MA%3D%3D',
          'https://plus.unsplash.com/premium_photo-1770646143936-6e64df320e24?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDR8fHxlbnwwfHx8fHw%3D'
        ]
      }
    ]
  },
  {
    name: 'Forest Trek',
    brand: 'Adidas',
    category: 'RUNNING',
    gender: 'MEN',
    description: 'Designed for the trail, the Forest Trek offers superior grip and stability on uneven terrain. The breathable mesh upper keeps your feet cool during long runs.',
    shortDescription: 'Trail running shoe',
    tags: ['running', 'trail', 'outdoor'],
    variants: [
      {
        size: 'US 9',
        color: 'Olive Green',
        sku: 'AD-FT-GRN-9',
        price: 135,
        quantity: 25,
        images: [
          'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8c2hvZXxlbnwwfHwwfHx8MA%3D%3D',
          'https://images.unsplash.com/photo-1662037132011-1c403fd1705c?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDEyMXx8fGVufDB8fHx8fA%3D%3D'
        ]
      },
      {
        size: 'US 10',
        color: 'Olive Green',
        sku: 'AD-FT-GRN-10',
        price: 135,
        quantity: 20,
        images: [
          'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8c2hvZXxlbnwwfHwwfHx8MA%3D%3D',
          'https://images.unsplash.com/photo-1662037132011-1c403fd1705c?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDEyMXx8fGVufDB8fHx8fA%3D%3D'
        ]
      }
    ]
  },
  {
    name: 'Vibrant Pulse',
    brand: 'Puma',
    category: 'SNEAKERS',
    gender: 'WOMEN',
    description: 'Make a statement with the Vibrant Pulse. Bold colors and a chunky silhouette combine for a modern, fashion-forward look.',
    shortDescription: 'Bold fashion sneaker',
    tags: ['fashion', 'chunky', 'bold'],
    variants: [
      {
        size: 'US 7',
        color: 'Cherry Red',
        sku: 'PU-VP-RED-7',
        price: 95,
        quantity: 40,
        images: [
          'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8c2hvZXxlbnwwfHwwfHx8MA%3D%3D',
          'https://media.istockphoto.com/id/1391533360/photo/red-sneakers-shoes.webp?a=1&b=1&s=612x612&w=0&k=20&c=U2b4oLbGuhCPjwzDM8-OyrHQoxY7zfZU8AG2TE19hog='
        ]
      },
      {
        size: 'US 6',
        color: 'Blush Pink',
        sku: 'PU-VP-PNK-6',
        price: 95,
        quantity: 35,
        images: [
          'https://images.unsplash.com/photo-1603036050855-0d77c10e1eb2?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDY0fHx8ZW58MHx8fHx8',
          'https://plus.unsplash.com/premium_photo-1726869684224-1a740e3f3880?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDM5fHx8ZW58MHx8fHx8'
        ]
      }
    ]
  },
  {
    name: 'Retro Colorblock',
    brand: 'New Balance',
    category: 'SNEAKERS',
    gender: 'UNISEX',
    description: 'A nod to the 90s, this sneaker features a vibrant color-blocked design and suede overlays. Perfect for adding a pop of color to any outfit.',
    shortDescription: 'Retro color-blocked sneaker',
    tags: ['retro', '90s', 'colorful'],
    variants: [
      {
        size: 'US 9',
        color: 'Multi',
        sku: 'NB-RC-MUL-9',
        price: 120,
        quantity: 60,
        images: [
          'https://images.unsplash.com/photo-1728724794795-681832a6afd0?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDMzfHx8ZW58MHx8fHx8',
          'https://images.unsplash.com/photo-1608666634759-4376010f863d?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDV8fHxlbnwwfHx8fHw%3D'
        ]
      },
      {
        size: 'US 10',
        color: 'Multi',
        sku: 'NB-RC-MUL-10',
        price: 120,
        quantity: 50,
        images: [
          'https://images.unsplash.com/photo-1728724794795-681832a6afd0?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDMzfHx8ZW58MHx8fHx8',
          'https://images.unsplash.com/photo-1608666634759-4376010f863d?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDV8fHxlbnwwfHx8fHw%3D'
        ]
      }
    ]
  },
  {
    name: 'Azure Elegance',
    brand: 'Clarks',
    category: 'FORMAL',
    gender: 'WOMEN',
    description: 'Elevate your evening look with these stunning blue heels. Detailed craftsmanship meets modern style.',
    shortDescription: 'Elegant blue formal shoe',
    tags: ['formal', 'evening', 'blue'],
    variants: [
      {
        size: 'US 7',
        color: 'Royal Blue',
        sku: 'CL-AE-BL-7',
        price: 150,
        quantity: 15,
        images: [
          'https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDQwfHx8ZW58MHx8fHx8',
          'https://images.unsplash.com/photo-1634624943305-4c8f49ba7226?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDI1fHx8ZW58MHx8fHx8'
        ]
      }
    ]
  }
];

async function seedProducts() {
  console.log('Seeding products...');

  for (const productData of products) {
    // Check if product with same name exists to avoid duplicates (simple check)
    const existingProduct = await prisma.product.findFirst({
      where: { name: productData.name }
    });

    if (existingProduct) {
      console.log(`Product "${productData.name}" already exists, skipping...`);
      continue;
    }

    console.log(`Creating product: ${productData.name}`);

    // Create Product
    const product = await prisma.product.create({
      data: {
        name: productData.name,
        brand: productData.brand,
        category: productData.category,
        gender: productData.gender,
        description: productData.description,
        shortDescription: productData.shortDescription,
        tags: productData.tags,
        isActive: true,
        isFeatured: Math.random() < 0.3, // Randomly feature some products
      }
    });

    // Create Variants and Images for this product
    for (const variantData of productData.variants) {
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          size: variantData.size,
          color: variantData.color,
          sku: variantData.sku,
          price: variantData.price,
          isAvailable: true,
          inventory: {
            create: {
              quantity: variantData.quantity
            }
          }
        }
      });

      // Add images from the defined list
      if (variantData.images && variantData.images.length > 0) {
        for (let i = 0; i < variantData.images.length; i++) {
          await prisma.productImage.create({
            data: {
              variantId: variant.id,
              url: variantData.images[i],
              altText: `${product.name} - ${variant.color} - View ${i + 1}`,
              position: i,
              isPrimary: i === 0
            }
          });
        }
      }
    }
  }
  console.log('Product seeding completed.');
}

async function runSeed() {
  await main();
  await seedProducts();
}

runSeed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
  });
