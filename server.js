// 1. Load environment variables FIRST (before any other code)
require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const cluster = require('cluster');
const os = require('os');

// 👇 Improved seeder integration
if (process.env.RUN_SEEDER === 'true') {
  (async () => {
    try {
      logger.info('Starting database seeding...');
      const seedDatabase = require('./seeder');
      await seedDatabase();
      logger.info('Database seeding completed successfully!');
      process.exit(0);
    } catch (err) {
      logger.error(`Seeder error: ${err.message}`);
      process.exit(1);
    }
  })();
}

// Handle uncaught exceptions
process.on('uncaughtException', err => {
  logger.error(`UNCAUGHT EXCEPTION! 💥 ${err.name}: ${err.message}`);
  process.exit(1);
});

// Configure port
const PORT = process.env.PORT || 3000;

// Cluster mode for production
if (process.env.NODE_ENV === 'production' && cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  logger.info(`Master ${process.pid} is running`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.error(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
    cluster.fork(); // Create a new worker
  });
} else {
  // Improved startup sequence for workers/development
  const startServer = async () => {
    try {
      // 1. Connect to database first
      await connectDB();

      // Only start server if not in seeder-only mode
      if (process.env.RUN_SEEDER !== 'true') {
        // 2. Start server
        const server = app.listen(PORT, () => {
          logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
          if (cluster.worker) {
            logger.info(`Worker ${cluster.worker.id} started`);
          }
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', err => {
          logger.error(`UNHANDLED REJECTION! 💥 ${err.name}: ${err.message}`);
          server.close(() => {
            process.exit(1);
          });
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
          logger.info('👋 SIGTERM RECEIVED. Shutting down gracefully');
          server.close(() => {
            logger.info('💥 Process terminated!');
            process.exit(0);
          });
        });
      } else {
        logger.info('Seeder completed. Exiting process as RUN_SEEDER=true');
        process.exit(0);
      }
    } catch (error) {
      logger.error(`Server startup failed: ${error.message}`);
      process.exit(1);
    }
  };

  startServer();
}
