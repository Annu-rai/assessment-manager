import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import { seedDemo, DEMO_ADMIN_EMAIL } from './utils/seed.js';

const app = createApp();
const PORT = process.env.PORT || 5000;

connectDB(process.env.MONGO_URI).then(async () => {
  // Seed demo data when the demo accounts are missing (or SEED_ON_START=true).
  // seedDemo only touches the demo org + demo logins, so it's safe to run on a
  // populated database — real user accounts are left untouched.
  try {
    const demoMissing = !(await User.exists({ email: DEMO_ADMIN_EMAIL }));
    if (process.env.SEED_ON_START === 'true' || demoMissing) {
      const demo = await seedDemo();
      console.log(`✓ Seeded demo data — login with ${demo.email} / ${demo.password}`);
    }
  } catch (err) {
    console.warn('Demo seed skipped:', err.message);
  }

  app.listen(PORT, () => console.log(`✓ API listening on port ${PORT}`));
});

export default app;
