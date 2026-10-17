import mongoose from 'mongoose';
import { logger } from '../config/logger.js';

export async function connectDb(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  logger.info(`MongoDB connected (database: ${mongoose.connection.name})`);
}

export async function disconnectDb() {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
