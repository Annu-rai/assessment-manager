import express from 'express';
import cors from 'cors';

import { notFound, errorHandler } from './middleware/error.js';
import authRoutes from './routes/authRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import assessmentRoutes from './routes/assessmentRoutes.js';
import responseRoutes from './routes/responseRoutes.js';

/**
 * Builds the Express app WITHOUT connecting to the database or starting a
 * listener. Keeping this separate from index.js lets tests import the app and
 * drive it with supertest against an in-memory MongoDB.
 */
export function createApp() {
  const app = express();

  const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  app.use(cors({ origin: origins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) =>
    res.json({ status: 'ok', time: new Date().toISOString() })
  );

  app.use('/api/auth', authRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/assessments', assessmentRoutes);
  app.use('/api/responses', responseRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
