import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { connectDB } from './config/db.js';
import { notFound, errorHandler } from './middleware/error.js';
import authRoutes from './routes/authRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import assessmentRoutes from './routes/assessmentRoutes.js';
import responseRoutes from './routes/responseRoutes.js';

const app = express();

// --- Core middleware ---
const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// --- Health check ---
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/responses', responseRoutes);

// --- Error handling ---
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB(process.env.MONGO_URI).then(() => {
  app.listen(PORT, () => console.log(`✓ API listening on http://localhost:${PORT}`));
});

export default app;
