const mongoose = require('mongoose');

let memoryServer = null;

const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGO_URI;

    // Developer fallback: run an in-memory MongoDB when MONGO_URI is not set.
    if (!mongoUri || !mongoUri.trim()) {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create({
        instance: { dbName: 'cvmaster' },
      });
      mongoUri = memoryServer.getUri();
      console.warn('[db] MONGO_URI is missing, using in-memory MongoDB');
    }

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[db] MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[db] MongoDB connection failed: ${error.message}`);
    throw error;
  }
};

const shutdownDB = async () => {
  await mongoose.connection.close().catch(() => {});
  if (memoryServer) {
    await memoryServer.stop().catch(() => {});
  }
};

process.on('SIGINT', async () => {
  await shutdownDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdownDB();
  process.exit(0);
});

module.exports = connectDB;
