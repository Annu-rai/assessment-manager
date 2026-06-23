/**
 * Seed a demo user and a sample assessment so a fresh database is usable
 * immediately. Run with: npm run seed
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Assessment from '../models/Assessment.js';

const DEMO = { name: 'Demo User', email: 'demo@example.com', password: 'demo1234' };

const sampleCategories = [
  {
    name: 'Work Environment',
    factors: [
      {
        name: 'Collaboration',
        questions: [
          { text: 'How would you rate team collaboration?', type: 'rating', options: [], ratingScale: 5 },
          {
            text: 'Which collaboration tools do you use?',
            type: 'multiple_choice',
            options: ['Slack', 'Email', 'Video calls', 'In person'],
          },
          { text: 'Do you feel heard in meetings?', type: 'boolean', options: [] },
        ],
      },
      {
        name: 'Tooling',
        questions: [
          {
            text: 'Pick your primary editor',
            type: 'single_choice',
            options: ['VS Code', 'JetBrains', 'Vim', 'Other'],
          },
          { text: 'Any suggestions to improve tooling?', type: 'text', options: [] },
        ],
      },
    ],
  },
];

async function run() {
  await connectDB(process.env.MONGO_URI);

  await Promise.all([
    User.deleteMany({ email: DEMO.email }),
  ]);

  const user = new User({ name: DEMO.name, email: DEMO.email });
  await user.setPassword(DEMO.password);
  await user.save();

  await Category.deleteMany({ owner: user.id });
  await Assessment.deleteMany({ owner: user.id });

  await Category.create(sampleCategories.map((c) => ({ ...c, owner: user.id })));
  await Assessment.create({
    title: 'Employee Experience Survey',
    description: 'A sample assessment created by the seed script.',
    owner: user.id,
    categories: sampleCategories,
  });

  console.log('✓ Seeded demo data');
  console.log(`  Login with  ${DEMO.email} / ${DEMO.password}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
