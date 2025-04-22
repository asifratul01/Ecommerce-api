const mongoose = require('mongoose');
const dotenv = require('dotenv');
const slugify = require('slugify');

dotenv.config();

const connectDB = require('./config/db');
const Category = require('./models/Category');
const User = require('./models/User');
const Product = require('./models/Product');
const Cart = require('./models/Cart');

const seedDatabase = async () => {
  try {
    console.log('Connecting to MongoDB with URI:', process.env.MONGO_URI);
    await connectDB();
    console.log('✅ DB connected for seeding');

    console.log('🧹 Clearing old data...');
    await Category.deleteMany({});
    await User.deleteMany({});
    await Product.deleteMany({});
    await Cart.deleteMany({});
    console.log('✅ Existing data deleted');

    // Seed categories
    const categoryData = [
      {
        name: 'Electronics',
        description: 'All electronic items',
        slug: slugify('Electronics', { lower: true, strict: true }),
      },
      {
        name: 'Clothing',
        description: 'Apparel and fashion',
        slug: slugify('Clothing', { lower: true, strict: true }),
      },
      {
        name: 'Books',
        description: 'Books and reading materials',
        slug: slugify('Books', { lower: true, strict: true }),
      },
    ];

    const categories = await Category.insertMany(categoryData, { ordered: true });
    console.log(`✅ ${categories.length} categories seeded`);

    // ✅ Use new User() + save() instead of create() to trigger middleware
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'admin123',
      passwordConfirm: 'admin123',
      role: 'admin',
    });
    await adminUser.save();

    const johnUser = new User({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'john1234',
      passwordConfirm: 'john1234',
      role: 'user',
    });
    await johnUser.save();

    console.log('✅ 2 users created with hashed passwords');

    // Seed products
    const productData = [
      {
        name: 'Laptop',
        slug: slugify('Laptop', { lower: true, strict: true }),
        description: 'High performance laptop',
        price: 999.99,
        category: categories[0]._id,
        stock: 10,
        sold: 0,
        images: [
          {
            url: 'https://example.com/laptop.jpg',
            altText: 'Laptop Image',
            isPrimary: true,
          },
        ],
        user: adminUser._id,
        isFeatured: true,
        isActive: true,
      },
      {
        name: 'T-shirt',
        slug: slugify('T-shirt', { lower: true, strict: true }),
        description: 'Comfortable cotton t-shirt',
        price: 19.99,
        category: categories[1]._id,
        stock: 50,
        sold: 10,
        images: [
          {
            url: 'https://example.com/tshirt.jpg',
            altText: 'T-shirt Image',
            isPrimary: true,
          },
        ],
        user: johnUser._id,
        isFeatured: false,
        isActive: true,
      },
    ];

    const products = await Product.insertMany(productData);
    console.log(`✅ ${products.length} products seeded`);

    // Seed cart for John Doe
    await Cart.create({
      user: johnUser._id,
      items: [
        {
          productId: products[1]._id,
          name: products[1].name,
          priceAtAddition: products[1].price,
          quantity: 2,
        },
      ],
      totalItems: 1,
      totalPrice: products[1].price * 2,
    });

    console.log('✅ Cart seeded for John Doe');
    console.log('🎉 Database seeding completed successfully!');
    process.exit();
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
