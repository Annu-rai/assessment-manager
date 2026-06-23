import mongoose from 'mongoose';

/**
 * Connect to MongoDB. Throws (and exits) on failure so the process does not
 * start in a half-broken state.
 */
export async function connectDB(uri) {
  if (!uri) {
    throw new Error('MONGO_URI is not set. Copy .env.example to .env and fill it in.');
  }

  mongoose.set('strictQuery', true);

  try {
    const conn = await mongoose.connect(uri);
    console.log(`✓ MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.error('✗ MongoDB connection error:', err.message);
    process.exit(1);
  }
}
