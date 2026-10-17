import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let server;

export async function connectTestDb() {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
}

export async function clearTestDb() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

export async function disconnectTestDb() {
  await mongoose.disconnect();
  await server?.stop();
}
