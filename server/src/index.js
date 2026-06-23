import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';

const app = createApp();
const PORT = process.env.PORT || 5000;

connectDB(process.env.MONGO_URI).then(() => {
  app.listen(PORT, () => console.log(`✓ API listening on http://localhost:${PORT}`));
});

export default app;
