import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { connectDB } from '../src/config/db.js';

// --- Shared test harness: one in-memory Mongo + app for the whole suite ---
let mongod;
let app;

before(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.CLIENT_ORIGIN = '*';

  mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  await connectDB(mongod.getUri('assessment_test'));
  app = createApp();
});

after(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

// Helper: register a fresh user and return its token.
async function freshUser(email) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Tester', email, password: 'secret123' });
  return res.body.token;
}

const sampleAssessment = {
  title: 'Engineering Culture',
  description: 'Q3 survey',
  categories: [
    {
      name: 'Collaboration',
      factors: [
        {
          name: 'Communication',
          questions: [
            { text: 'Rate team communication', type: 'rating', options: [], ratingScale: 5 },
            { text: 'Preferred channels?', type: 'multiple_choice', options: ['Slack', 'Email'] },
            { text: 'Any comments?', type: 'text', options: [] },
          ],
        },
      ],
    },
  ],
};

describe('health', () => {
  test('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });
});

describe('auth', () => {
  test('registers a user and returns a token without leaking the hash', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ada', email: 'ada@example.com', password: 'secret123' });

    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, 'ada@example.com');
    assert.equal(res.body.user.passwordHash, undefined);
  });

  test('rejects duplicate email with 409', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dup', email: 'dup@example.com', password: 'secret123' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dup2', email: 'dup@example.com', password: 'secret123' });
    assert.equal(res.status, 409);
  });

  test('rejects a short password with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Short', email: 'short@example.com', password: '123' });
    assert.equal(res.status, 400);
  });

  test('logs in with valid credentials and rejects bad ones', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Lin', email: 'lin@example.com', password: 'secret123' });

    const ok = await request(app)
      .post('/api/auth/login')
      .send({ email: 'lin@example.com', password: 'secret123' });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: 'lin@example.com', password: 'wrong' });
    assert.equal(bad.status, 401);
  });
});

describe('authorization gate', () => {
  test('blocks protected routes without a token', async () => {
    const res = await request(app).get('/api/assessments');
    assert.equal(res.status, 401);
  });

  test('blocks protected routes with an invalid token', async () => {
    const res = await request(app)
      .get('/api/assessments')
      .set('Authorization', 'Bearer not-a-real-token');
    assert.equal(res.status, 401);
  });
});

describe('assessments', () => {
  test('creates an assessment, computes questionCount, mirrors categories', async () => {
    const token = await freshUser('builder@example.com');

    const res = await request(app)
      .post('/api/assessments')
      .set('Authorization', `Bearer ${token}`)
      .send(sampleAssessment);

    assert.equal(res.status, 201);
    assert.equal(res.body.questionCount, 3);

    // Categories should be mirrored to the reusable library (Load Categories).
    const lib = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(lib.status, 200);
    assert.equal(lib.body.length, 1);
    assert.equal(lib.body[0].name, 'Collaboration');
  });

  test('rejects an assessment with no title (400)', async () => {
    const token = await freshUser('notitle@example.com');
    const res = await request(app)
      .post('/api/assessments')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...sampleAssessment, title: '' });
    assert.equal(res.status, 400);
  });

  test('isolates data between users', async () => {
    const tokenA = await freshUser('usera@example.com');
    await request(app)
      .post('/api/assessments')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(sampleAssessment);

    const tokenB = await freshUser('userb@example.com');
    const res = await request(app)
      .get('/api/assessments')
      .set('Authorization', `Bearer ${tokenB}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 0); // B sees none of A's data
  });
});

describe('responses & reports', () => {
  test('submits answers, denormalises metadata, and lists in reports', async () => {
    const token = await freshUser('responder@example.com');

    const created = await request(app)
      .post('/api/assessments')
      .set('Authorization', `Bearer ${token}`)
      .send(sampleAssessment);

    const questions = created.body.categories[0].factors[0].questions;
    const answers = [
      { questionId: questions[0]._id, answer: 4 },
      { questionId: questions[1]._id, answer: ['Slack', 'Email'] },
      { questionId: questions[2]._id, answer: 'Great team!' },
    ];

    const submit = await request(app)
      .post('/api/responses')
      .set('Authorization', `Bearer ${token}`)
      .send({ assessmentId: created.body._id, answers });

    assert.equal(submit.status, 201);
    assert.equal(submit.body.answers.length, 3);
    assert.equal(submit.body.answers[0].questionText, 'Rate team communication');
    assert.equal(submit.body.answers[0].categoryName, 'Collaboration');

    const report = await request(app)
      .get('/api/responses')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(report.status, 200);
    assert.equal(report.body.length, 1);
    assert.equal(report.body[0].assessment.title, 'Engineering Culture');
  });

  test('rejects a submission when no answers match the assessment (400)', async () => {
    const token = await freshUser('badanswers@example.com');
    const created = await request(app)
      .post('/api/assessments')
      .set('Authorization', `Bearer ${token}`)
      .send(sampleAssessment);

    const res = await request(app)
      .post('/api/responses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        assessmentId: created.body._id,
        answers: [{ questionId: '64b64b64b64b64b64b64b64b', answer: 'x' }],
      });
    assert.equal(res.status, 400);
  });
});
