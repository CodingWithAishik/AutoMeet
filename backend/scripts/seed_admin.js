// Non-destructive admin bootstrap script for production.
// - Does NOT delete any data
// - Inserts admin user if missing
// - Updates the admin password if the user already exists

const mongoose = require('mongoose');
require('dotenv').config();
const bcrypt = require('bcrypt');

const User = require('../models/user.model');

const MONGO_URI = process.env.MONGO_URI || process.env.DB_CONNECT;

// Bootstrap admin credentials from environment variables.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@cs2191.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_FIRST_NAME = process.env.ADMIN_FIRST_NAME || 'Admin';
const ADMIN_LAST_NAME = process.env.ADMIN_LAST_NAME || 'User';

async function seedAdmin() {
  if (!MONGO_URI) {
    console.error('Missing DB connection string. Set MONGO_URI or DB_CONNECT before running.');
    process.exit(1);
  }

  if (!ADMIN_PASSWORD) {
    console.error('Missing ADMIN_PASSWORD. Set ADMIN_PASSWORD before running.');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });

    if (existingAdmin) {
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      existingAdmin.password = hashedPassword;
      existingAdmin.status = 'admin';
      await existingAdmin.save();
      console.log('Existing admin password updated successfully.');
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    await User.create({
      fullname: { firstname: ADMIN_FIRST_NAME, lastname: ADMIN_LAST_NAME },
      email: ADMIN_EMAIL,
      password: hashedPassword,
      status: 'admin',
    });

    console.log('Admin user inserted successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin user:', error.message);
    process.exit(1);
  }
}

seedAdmin();
