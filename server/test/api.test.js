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

// A scored assessment used by the RBAC + scoring tests below.
const scoredAssessment = {
  title: 'JS Quiz',
  categories: [
    {
      name: 'Basics',
      factors: [
        {
          name: 'Core',
          questions: [
            {
              text: 'Block-scoped keyword?',
              type: 'single_choice',
              options: ['var', 'let'],
              correctAnswer: 'let',
              points: 2,
            },
            {
              text: 'typeof null is "object"?',
              type: 'boolean',
              options: [],
              correctAnswer: 'Yes',
              points: 1,
            },
            { text: 'Comments?', type: 'text', options: [] }, // ungraded
          ],
        },
      ],
    },
  ],
  passingScore: 60,
};

describe('RBAC + multi-org', () => {
  test('register creates an org and makes the signer an org_admin', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Owner', email: 'owner@rbac.com', password: 'secret123', organizationName: 'Acme' });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'org_admin');
    assert.ok(res.body.user.organization);
    assert.equal(res.body.organization.name, 'Acme');
  });

  test('org_admin can create a candidate who cannot build assessments', async () => {
    const adminToken = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'Boss', email: 'boss@rbac.com', password: 'secret123' })).body.token;

    const made = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Cand', email: 'cand@rbac.com', password: 'secret123', role: 'candidate' });
    assert.equal(made.status, 201);
    assert.equal(made.body.role, 'candidate');

    const candToken = (await request(app)
      .post('/api/auth/login')
      .send({ email: 'cand@rbac.com', password: 'secret123' })).body.token;

    // Candidate is forbidden from creating assessments (staff-only route).
    const blocked = await request(app)
      .post('/api/assessments')
      .set('Authorization', `Bearer ${candToken}`)
      .send(scoredAssessment);
    assert.equal(blocked.status, 403);

    // Candidate is also blocked from user management.
    const noUsers = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${candToken}`);
    assert.equal(noUsers.status, 403);
  });
});

describe('scoring', () => {
  test('grades a submission, hides the answer key, computes pass/fail', async () => {
    const adminToken = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'Grader', email: 'grader@score.com', password: 'secret123' })).body.token;

    const cand = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Taker', email: 'taker@score.com', password: 'secret123', role: 'candidate' });

    const created = await request(app)
      .post('/api/assessments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...scoredAssessment, status: 'published', assignedTo: [cand.body._id] });

    const qs = created.body.categories[0].factors[0].questions;

    const candToken = (await request(app)
      .post('/api/auth/login')
      .send({ email: 'taker@score.com', password: 'secret123' })).body.token;

    // Candidate fetching the assessment must NOT see the answer key.
    const fetched = await request(app)
      .get(`/api/assessments/${created.body._id}`)
      .set('Authorization', `Bearer ${candToken}`);
    assert.equal(fetched.body.categories[0].factors[0].questions[0].correctAnswer, undefined);

    // single_choice right (2 pts), boolean wrong ('No' vs 'Yes', 0/1), text ignored → 2/3 = 67%.
    const submit = await request(app)
      .post('/api/responses')
      .set('Authorization', `Bearer ${candToken}`)
      .send({
        assessmentId: created.body._id,
        answers: [
          { questionId: qs[0]._id, answer: 'let' },
          { questionId: qs[1]._id, answer: 'No' },
          { questionId: qs[2]._id, answer: 'no comment' },
        ],
      });

    assert.equal(submit.status, 201);
    assert.equal(submit.body.graded, true);
    assert.equal(submit.body.score, 2);
    assert.equal(submit.body.maxScore, 3);
    assert.equal(submit.body.percentage, 67);
    assert.equal(submit.body.passed, true);
  });
});

describe('question types + scoring', () => {
  test('grades numerical (tolerance), fill_blank (acceptable list), and match', async () => {
    const token = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'Types', email: 'types@score.com', password: 'secret123' })).body.token;

    const created = await request(app)
      .post('/api/assessments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Mixed Types',
        passingScore: 50,
        categories: [
          {
            name: 'Mixed',
            factors: [
              {
                name: 'All',
                questions: [
                  { text: 'pi to 2dp?', type: 'numerical', correctAnswer: 3.14, tolerance: 0.01, points: 1 },
                  { text: 'colour word', type: 'fill_blank', correctAnswer: ['color', 'colour'], points: 1 },
                  {
                    text: 'match methods',
                    type: 'match',
                    pairs: [{ left: 'GET', right: 'Read' }, { left: 'POST', right: 'Create' }],
                    points: 2,
                  },
                  { text: 'essay', type: 'essay', points: 5 }, // ungraded
                ],
              },
            ],
          },
        ],
      });

    const qs = created.body.categories[0].factors[0].questions;
    const submit = await request(app)
      .post('/api/responses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        assessmentId: created.body._id,
        answers: [
          { questionId: qs[0]._id, answer: 3.145 }, // within tolerance 0.01? |3.145-3.14|=0.005 -> correct
          { questionId: qs[1]._id, answer: 'Colour' }, // acceptable, case-insensitive
          { questionId: qs[2]._id, answer: { GET: 'Read', POST: 'Create' } }, // both pairs correct
          { questionId: qs[3]._id, answer: 'some prose' }, // ungraded
        ],
      });

    assert.equal(submit.status, 201);
    // 1 (numerical) + 1 (fill_blank) + 2 (match) = 4 of 4 graded points.
    assert.equal(submit.body.score, 4);
    assert.equal(submit.body.maxScore, 4);
    assert.equal(submit.body.percentage, 100);
    assert.equal(submit.body.passed, true);
    const byType = Object.fromEntries(submit.body.answers.map((a) => [a.type, a.isCorrect]));
    assert.equal(byType.numerical, true);
    assert.equal(byType.fill_blank, true);
    assert.equal(byType.match, true);
    assert.equal(byType.essay, null); // ungraded
  });
});

describe('question bank', () => {
  test('creates, filters, randomizes and deletes bank questions', async () => {
    const token = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bank', email: 'bank@qb.com', password: 'secret123' })).body.token;

    const mk = (text, difficulty, tags) =>
      request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${token}`)
        .send({ text, type: 'single_choice', options: ['a', 'b'], correctAnswer: 'a', difficulty, tags });

    await mk('Easy one', 'easy', ['x']);
    await mk('Hard one', 'hard', ['y']);
    await mk('Another hard', 'hard', ['y']);

    const all = await request(app).get('/api/questions').set('Authorization', `Bearer ${token}`);
    assert.equal(all.body.length, 3);

    const hard = await request(app)
      .get('/api/questions?difficulty=hard')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(hard.body.length, 2);

    const rand = await request(app)
      .get('/api/questions/random?count=2')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(rand.body.length, 2);

    const del = await request(app)
      .delete(`/api/questions/${all.body[0]._id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(del.status, 200);

    const after = await request(app).get('/api/questions').set('Authorization', `Bearer ${token}`);
    assert.equal(after.body.length, 2);
  });

  test('candidates cannot access the question bank (403)', async () => {
    const adminToken = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'QBAdmin', email: 'qbadmin@qb.com', password: 'secret123' })).body.token;
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'C', email: 'qbc@qb.com', password: 'secret123', role: 'candidate' });
    const candToken = (await request(app)
      .post('/api/auth/login')
      .send({ email: 'qbc@qb.com', password: 'secret123' })).body.token;

    const res = await request(app).get('/api/questions').set('Authorization', `Bearer ${candToken}`);
    assert.equal(res.status, 403);
  });
});

describe('file uploads', () => {
  test('uploads a file and serves it back statically', async () => {
    const token = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'Up', email: 'up@files.com', password: 'secret123' })).body.token;

    const up = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('hello world'), 'note.txt');

    assert.equal(up.status, 201);
    assert.match(up.body.url, /^\/uploads\//);
    assert.equal(up.body.filename, 'note.txt');

    // The returned URL is served by the static middleware.
    const served = await request(app).get(up.body.url);
    assert.equal(served.status, 200);
    assert.equal(served.text, 'hello world');
  });

  test('rejects an upload with no file (400)', async () => {
    const token = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'NoFile', email: 'nofile@files.com', password: 'secret123' })).body.token;
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 400);
  });
});

describe('public links', () => {
  test('generates a link, serves it anonymously (no answer key), and scores a guest', async () => {
    const token = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'Pub', email: 'pub@links.com', password: 'secret123' })).body.token;

    const created = await request(app)
      .post('/api/assessments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Public Quiz',
        passingScore: 50,
        categories: [
          {
            name: 'C',
            factors: [
              {
                name: 'F',
                questions: [
                  { text: '2+2?', type: 'numerical', correctAnswer: 4, points: 1 },
                  { text: 'block scope kw', type: 'fill_blank', correctAnswer: ['let'], points: 1 },
                ],
              },
            ],
          },
        ],
      });

    // Enable the public link.
    const link = await request(app)
      .post(`/api/assessments/${created.body._id}/public-link`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true });
    assert.equal(link.status, 200);
    assert.equal(link.body.isPublic, true);
    assert.ok(link.body.publicId);
    const pid = link.body.publicId;

    // Anonymous fetch (no auth) — answer key must be absent.
    const pub = await request(app).get(`/api/public/assessments/${pid}`);
    assert.equal(pub.status, 200);
    const q = pub.body.categories[0].factors[0].questions;
    assert.equal('correctAnswer' in q[0], false);

    // Anonymous submission gets graded.
    const submit = await request(app)
      .post(`/api/public/assessments/${pid}/submit`)
      .send({
        name: 'Guest Joe',
        email: 'guestjoe@ext.com',
        answers: [
          { questionId: q[0]._id, answer: 4 },
          { questionId: q[1]._id, answer: 'let' },
        ],
      });
    assert.equal(submit.status, 201);
    assert.equal(submit.body.score, 2);
    assert.equal(submit.body.percentage, 100);
    assert.equal(submit.body.passed, true);

    // The guest submission shows up in the owner's Reports.
    const reports = await request(app).get('/api/responses').set('Authorization', `Bearer ${token}`);
    const forThis = reports.body.filter((r) => r.assessment?.title === 'Public Quiz');
    assert.equal(forThis.length, 1);
    assert.equal(forThis[0].respondent.name, 'Guest Joe');
  });

  test('an inactive/unknown public id returns 404', async () => {
    const res = await request(app).get('/api/public/assessments/does-not-exist');
    assert.equal(res.status, 404);
  });
});

describe('AI question generator', () => {
  // Tests run without ANTHROPIC_API_KEY, so AI is disabled — we assert the
  // graceful-degradation path and the access controls (not a live model call).
  test('status reports disabled without a key; generate returns 503', async () => {
    const token = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'AI', email: 'ai@gen.com', password: 'secret123' })).body.token;

    const status = await request(app).get('/api/ai/status').set('Authorization', `Bearer ${token}`);
    assert.equal(status.status, 200);
    assert.equal(status.body.enabled, false);
    assert.ok(Array.isArray(status.body.types));

    const gen = await request(app)
      .post('/api/ai/generate-questions')
      .set('Authorization', `Bearer ${token}`)
      .send({ topic: 'React', count: 3 });
    assert.equal(gen.status, 503); // no key configured
  });

  test('rejects generation with no topic (400)', async () => {
    const token = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'AI2', email: 'ai2@gen.com', password: 'secret123' })).body.token;
    const res = await request(app)
      .post('/api/ai/generate-questions')
      .set('Authorization', `Bearer ${token}`)
      .send({ count: 3 });
    assert.equal(res.status, 400);
  });

  test('candidates cannot use AI tools (403)', async () => {
    const adminToken = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'AIAdmin', email: 'aiadmin@gen.com', password: 'secret123' })).body.token;
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'C', email: 'aic@gen.com', password: 'secret123', role: 'candidate' });
    const candToken = (await request(app)
      .post('/api/auth/login')
      .send({ email: 'aic@gen.com', password: 'secret123' })).body.token;

    const res = await request(app).get('/api/ai/status').set('Authorization', `Bearer ${candToken}`);
    assert.equal(res.status, 403);
  });

  test('evaluate-response returns 503 without a key', async () => {
    const token = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'Eval', email: 'eval@ai.com', password: 'secret123' })).body.token;

    // Create an assessment with an essay question and submit an answer.
    const created = await request(app)
      .post('/api/assessments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Essay Test',
        categories: [
          { name: 'C', factors: [{ name: 'F', questions: [{ text: 'Explain closures', type: 'essay', points: 5 }] }] },
        ],
      });
    const qid = created.body.categories[0].factors[0].questions[0]._id;
    const submit = await request(app)
      .post('/api/responses')
      .set('Authorization', `Bearer ${token}`)
      .send({ assessmentId: created.body._id, answers: [{ questionId: qid, answer: 'A closure is...' }] });

    const res = await request(app)
      .post(`/api/ai/evaluate-response/${submit.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 503); // no key configured
  });
});

describe('AI insights + chat (no key)', () => {
  test('insights and chat return 503 without a key', async () => {
    const token = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'AI3', email: 'ai3@x.com', password: 'secret123' })).body.token;

    const ins = await request(app).get('/api/ai/insights').set('Authorization', `Bearer ${token}`);
    assert.equal(ins.status, 503);

    const chat = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ messages: [{ role: 'user', content: 'hi' }] });
    assert.equal(chat.status, 503);
  });
});

describe('certificates', () => {
  test('auto-issues on pass, downloads a PDF, and verifies publicly', async () => {
    const token = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'Cert', email: 'cert@x.com', password: 'secret123' })).body.token;

    const created = await request(app)
      .post('/api/assessments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Cert Test',
        passingScore: 50,
        categories: [
          { name: 'C', factors: [{ name: 'F', questions: [{ text: 'Pick a', type: 'single_choice', options: ['a', 'b'], correctAnswer: 'a', points: 1 }] }] },
        ],
      });
    const qid = created.body.categories[0].factors[0].questions[0]._id;

    const submit = await request(app)
      .post('/api/responses')
      .set('Authorization', `Bearer ${token}`)
      .send({ assessmentId: created.body._id, answers: [{ questionId: qid, answer: 'a' }] });
    assert.equal(submit.body.passed, true);

    const list = await request(app).get('/api/certificates').set('Authorization', `Bearer ${token}`);
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 1);
    const certId = list.body[0].certificateId;

    const pdf = await request(app)
      .get(`/api/certificates/${certId}/download`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers['content-type'], /pdf/);

    // Public verification — no auth.
    const verify = await request(app).get(`/api/public/verify/${certId}`);
    assert.equal(verify.status, 200);
    assert.equal(verify.body.valid, true);
    assert.equal(verify.body.percentage, 100);

    // Unknown id → not valid.
    const bad = await request(app).get('/api/public/verify/nope');
    assert.equal(bad.body.valid, false);
  });
});

describe('email invites', () => {
  test('invites publish a public link and report sent addresses', async () => {
    const token = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'Inv', email: 'inv@x.com', password: 'secret123' })).body.token;

    const created = await request(app)
      .post('/api/assessments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Invite Test',
        categories: [{ name: 'C', factors: [{ name: 'F', questions: [{ text: 'Q', type: 'text' }] }] }],
      });

    const res = await request(app)
      .post(`/api/assessments/${created.body._id}/invite`)
      .set('Authorization', `Bearer ${token}`)
      .send({ emails: ['alice@ext.com', 'bob@ext.com'] });
    assert.equal(res.status, 200);
    assert.equal(res.body.sent.length, 2);
    assert.match(res.body.link, /\/t\//);
    assert.equal(res.body.delivered, false); // no SMTP configured in tests

    const rejected = await request(app)
      .post(`/api/assessments/${created.body._id}/invite`)
      .set('Authorization', `Bearer ${token}`)
      .send({ emails: [] });
    assert.equal(rejected.status, 400);
  });
});

describe('exports', () => {
  test('exports responses as CSV and XLSX, candidates as CSV', async () => {
    const token = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'Exp', email: 'exp@x.com', password: 'secret123' })).body.token;

    // Create + submit so there's a row to export.
    const created = await request(app)
      .post('/api/assessments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Export Test',
        passingScore: 50,
        categories: [
          { name: 'C', factors: [{ name: 'F', questions: [{ text: 'Pick', type: 'single_choice', options: ['a', 'b'], correctAnswer: 'a', points: 1 }] }] },
        ],
      });
    const qid = created.body.categories[0].factors[0].questions[0]._id;
    await request(app)
      .post('/api/responses')
      .set('Authorization', `Bearer ${token}`)
      .send({ assessmentId: created.body._id, answers: [{ questionId: qid, answer: 'a' }] });

    const csv = await request(app).get('/api/export/responses?format=csv').set('Authorization', `Bearer ${token}`);
    assert.equal(csv.status, 200);
    assert.match(csv.headers['content-type'], /csv/);
    assert.match(csv.text, /Candidate,Email,Assessment/);
    assert.match(csv.text, /Export Test/);

    const xlsx = await request(app).get('/api/export/responses?format=xlsx').set('Authorization', `Bearer ${token}`);
    assert.equal(xlsx.status, 200);
    assert.match(xlsx.headers['content-type'], /spreadsheetml/);

    const cands = await request(app).get('/api/export/candidates?format=csv').set('Authorization', `Bearer ${token}`);
    assert.equal(cands.status, 200);
    assert.match(cands.text, /Name,Email,Role,Status/);
  });

  test('candidates cannot use exports (403)', async () => {
    const adminToken = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'ExpAdmin', email: 'expadmin@x.com', password: 'secret123' })).body.token;
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'C', email: 'expc@x.com', password: 'secret123', role: 'candidate' });
    const candToken = (await request(app)
      .post('/api/auth/login')
      .send({ email: 'expc@x.com', password: 'secret123' })).body.token;

    const res = await request(app).get('/api/export/responses?format=csv').set('Authorization', `Bearer ${candToken}`);
    assert.equal(res.status, 403);
  });
});

describe('white-label branding', () => {
  test('org admin updates name, logo and primary color', async () => {
    const token = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'Brand', email: 'brand@x.com', password: 'secret123' })).body.token;

    const upd = await request(app)
      .put('/api/organizations/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Acme X', primaryColor: '#ff0000', logoUrl: 'http://x/logo.png' });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.primaryColor, '#ff0000');
    assert.equal(upd.body.name, 'Acme X');

    const me = await request(app).get('/api/organizations/me').set('Authorization', `Bearer ${token}`);
    assert.equal(me.body.logoUrl, 'http://x/logo.png');
  });
});

describe('audit logs', () => {
  test('records admin actions and lists them', async () => {
    const token = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'Aud', email: 'aud@x.com', password: 'secret123' })).body.token;

    await request(app)
      .post('/api/assessments')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Audited', categories: [{ name: 'C', factors: [{ name: 'F', questions: [{ text: 'Q', type: 'text' }] }] }] });

    // Audit writes are fire-and-forget; give them a moment to land.
    await new Promise((r) => setTimeout(r, 300));

    const res = await request(app).get('/api/audit').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.some((l) => l.action === 'assessment.create'));
  });

  test('candidates cannot view audit logs (403)', async () => {
    const adminToken = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'AudAdmin', email: 'audadmin@x.com', password: 'secret123' })).body.token;
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'C', email: 'audc@x.com', password: 'secret123', role: 'candidate' });
    const candToken = (await request(app)
      .post('/api/auth/login')
      .send({ email: 'audc@x.com', password: 'secret123' })).body.token;

    const res = await request(app).get('/api/audit').set('Authorization', `Bearer ${candToken}`);
    assert.equal(res.status, 403);
  });
});

describe('AI recommendation (no key)', () => {
  test('returns 503 without a key', async () => {
    const token = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'Rec', email: 'rec@x.com', password: 'secret123' })).body.token;
    const cand = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cand', email: 'recc@x.com', password: 'secret123', role: 'candidate' });

    const res = await request(app)
      .get(`/api/ai/recommendation/${cand.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 503);
  });
});

describe('dashboard', () => {
  test('returns KPI payload for staff', async () => {
    const token = (await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dash', email: 'dash@kpi.com', password: 'secret123' })).body.token;

    await request(app)
      .post('/api/assessments')
      .set('Authorization', `Bearer ${token}`)
      .send(scoredAssessment);

    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.kpis.totalAssessments, 1);
    assert.ok(Array.isArray(res.body.topCategories));
  });
});
