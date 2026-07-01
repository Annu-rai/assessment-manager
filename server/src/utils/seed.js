/**
 * Seed a demo organization with users across every role and a sample scored
 * assessment, so a fresh database is usable immediately. Run with: npm run seed
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Category from '../models/Category.js';
import Assessment from '../models/Assessment.js';
import Question from '../models/Question.js';
import { ROLES } from '../config/roles.js';

const DEFAULT_PASSWORD = 'demo1234';

// One demo login per role. Every account uses DEFAULT_PASSWORD.
const DEMO_USERS = [
  { name: 'Sara Admin', email: 'admin@demo.com', role: ROLES.ORG_ADMIN },
  { name: 'Ravi Recruiter', email: 'recruiter@demo.com', role: ROLES.RECRUITER },
  { name: 'Ivy Interviewer', email: 'interviewer@demo.com', role: ROLES.INTERVIEWER },
  { name: 'Cara Candidate', email: 'candidate@demo.com', role: ROLES.CANDIDATE },
];

const SUPER_ADMIN = { name: 'Platform Owner', email: 'super@demo.com', role: ROLES.SUPER_ADMIN };

// A scored assessment: choice/boolean questions carry a correctAnswer + points.
const sampleCategories = [
  {
    name: 'JavaScript Fundamentals',
    factors: [
      {
        name: 'Core Language',
        questions: [
          {
            text: 'Which keyword declares a block-scoped variable?',
            type: 'single_choice',
            options: ['var', 'let', 'function', 'global'],
            correctAnswer: 'let',
            points: 1,
          },
          {
            text: 'Which of these are falsy in JavaScript?',
            type: 'multiple_choice',
            options: ['0', '"0"', 'null', 'undefined'],
            correctAnswer: ['0', 'null', 'undefined'],
            points: 2,
          },
          {
            text: 'typeof null === "object" is true.',
            type: 'boolean',
            options: [],
            correctAnswer: 'Yes',
            points: 1,
          },
        ],
      },
      {
        name: 'Experience',
        questions: [
          // Ungraded survey-style question (no correctAnswer) — ignored by scoring.
          { text: 'Any comments on the test?', type: 'text', options: [] },
          { text: 'Rate your JS confidence', type: 'rating', options: [], ratingScale: 5 },
        ],
      },
    ],
  },
];

// A small starter Question Bank (Module 8) showing the new question types.
const bankQuestions = [
  {
    text: 'What is 12 * 12?',
    type: 'numerical',
    correctAnswer: 144,
    tolerance: 0,
    points: 1,
    topic: 'Math',
    difficulty: 'easy',
    tags: ['arithmetic'],
  },
  {
    text: 'The CSS property to change text color is ______.',
    type: 'fill_blank',
    correctAnswer: ['color'],
    points: 1,
    topic: 'CSS',
    difficulty: 'easy',
    tags: ['css', 'frontend'],
  },
  {
    text: 'Match each HTTP method to its purpose.',
    type: 'match',
    pairs: [
      { left: 'GET', right: 'Read' },
      { left: 'POST', right: 'Create' },
      { left: 'DELETE', right: 'Remove' },
    ],
    points: 3,
    topic: 'HTTP',
    difficulty: 'medium',
    tags: ['http', 'backend'],
  },
  {
    text: 'Which are JavaScript array methods?',
    type: 'multiple_choice',
    options: ['map', 'filter', 'sort', 'sqrt'],
    correctAnswer: ['map', 'filter', 'sort'],
    points: 2,
    topic: 'JavaScript',
    difficulty: 'medium',
    tags: ['javascript'],
  },
  {
    text: 'Explain the difference between == and === in JavaScript.',
    type: 'essay',
    points: 5,
    topic: 'JavaScript',
    difficulty: 'hard',
    tags: ['javascript'],
  },
];

// Seed the demo org + users + sample data. Assumes a live Mongoose connection.
// Reused by the CLI runner below and by the local dev launcher (dev-local.mjs).
export async function seedDemo() {
  const emails = [SUPER_ADMIN.email, ...DEMO_USERS.map((u) => u.email)];

  // Clean slate for the demo accounts and their org.
  await User.deleteMany({ email: { $in: emails } });
  await Organization.deleteMany({ slug: 'demo-org' });

  const org = await Organization.create({ name: 'Demo Org', slug: 'demo-org', plan: 'pro' });

  const created = {};
  for (const u of DEMO_USERS) {
    const user = new User({ name: u.name, email: u.email, role: u.role, organization: org._id });
    await user.setPassword(DEFAULT_PASSWORD);
    await user.save();
    created[u.role] = user;
  }

  // Platform super admin lives outside any single org.
  const superAdmin = new User({ name: SUPER_ADMIN.name, email: SUPER_ADMIN.email, role: SUPER_ADMIN.role });
  await superAdmin.setPassword(DEFAULT_PASSWORD);
  await superAdmin.save();

  const admin = created[ROLES.ORG_ADMIN];
  const candidate = created[ROLES.CANDIDATE];

  await Category.deleteMany({ organization: org._id });
  await Assessment.deleteMany({ organization: org._id });
  await Question.deleteMany({ organization: org._id });

  // Seed a small Question Bank spanning several types + difficulties.
  await Question.create(
    bankQuestions.map((q) => ({ ...q, owner: admin.id, organization: org._id }))
  );

  await Category.create(
    sampleCategories.map((c) => ({ ...c, owner: admin.id, organization: org._id }))
  );
  await Assessment.create({
    title: 'JavaScript Screening Test',
    description: 'A sample scored assessment created by the seed script.',
    owner: admin.id,
    organization: org._id,
    categories: sampleCategories,
    passingScore: 60,
    timeLimitMinutes: 30,
    status: 'published',
    assignedTo: [candidate.id],
  });

  return {
    email: admin.email,
    password: DEFAULT_PASSWORD,
    logins: emails.map((e) => `${e} / ${DEFAULT_PASSWORD}`),
  };
}

async function run() {
  await connectDB(process.env.MONGO_URI);
  const demo = await seedDemo();
  console.log('✓ Seeded demo organization + users');
  demo.logins.forEach((l) => console.log(`  ${l}`));
  await mongoose.disconnect();
  process.exit(0);
}

// Only run as a CLI when invoked directly (not when imported for the function).
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  run().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
