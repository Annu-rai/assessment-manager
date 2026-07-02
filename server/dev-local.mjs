// Local dev launcher: boots an in-memory MongoDB (no install/Docker needed)
// and starts the real API against it. Run with: npm run dev:local
import 'dotenv/config';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from './src/app.js';
import { connectDB } from './src/config/db.js';
import { seedDemo } from './src/utils/seed.js';

const mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
const uri = mongod.getUri('assessment_app');
console.log(`✓ In-memory MongoDB started at ${uri}`);

await connectDB(uri);

const demo = await seedDemo();
console.log(`✓ Seeded demo data — login with ${demo.email} / ${demo.password}`);

const app = createApp();
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () =>
  console.log(`✓ API listening on http://localhost:${PORT}`)
);

async function shutdown() {
  await new Promise((r) => server.close(r));
  await mongod.stop();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
