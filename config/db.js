const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    // Validate MONGO_URI exists before attempting connection
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not accessible - Please check your environment variables');
    }

    // Simplified connection with modern Mongoose (v6+)
    await mongoose.connect(process.env.MONGO_URI);
    logger.info('DB connection successful!');

    // Connection event listeners
    mongoose.connection.on('connected', () => {
      logger.info('Mongoose connected to DB');
    });

    mongoose.connection.on('error', err => {
      logger.error(`Mongoose connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('Mongoose disconnected');
    });

    // Close connection on app termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('Mongoose connection closed due to app termination');
      process.exit(0);
    });
  } catch (err) {
    logger.error(`DB connection error: ${err.message}`); // Added .message for cleaner logs
    process.exit(1);
  }
};

module.exports = connectDB;
