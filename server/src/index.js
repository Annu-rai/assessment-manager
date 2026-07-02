import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import { seedDemo } from './utils/seed.js';

const app = createApp();
const PORT = process.env.PORT || 5000;

connectDB(process.env.MONGO_URI).then(async () => {
  // First boot on an empty database (or SEED_ON_START=true): seed demo data so
  // the deployed app is usable immediately. Skipped once any users exist, so it
  // never wipes real data on later restarts.
  try {
    const shouldSeed =
      process.env.SEED_ON_START === 'true' || (await User.estimatedDocumentCount()) === 0;
    if (shouldSeed) {
      const demo = await seedDemo();
      console.log(`✓ Seeded demo data — login with ${demo.email} / ${demo.password}`);
    }
  } catch (err) {
    console.warn('Demo seed skipped:', err.message);
  }

  app.listen(PORT, () => console.log(`✓ API listening on port ${PORT}`));
});

export default app;
