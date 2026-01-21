import 'dotenv/config';
import express from 'express';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { beautifyRouter } from './routes/beautify.js';
import { historyRouter } from './routes/history.js';
import { batchRouter } from './routes/batch.js';
import { pptxRouter } from './routes/pptx.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(corsMiddleware);
app.use(express.json({ limit: '200mb' })); // Increased for batch uploads

// Health check (no auth required)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Auth route (no auth required)
app.use('/api/auth', authRouter);

// Protected routes
app.use('/api/beautify', authMiddleware, beautifyRouter);
app.use('/api/history', authMiddleware, historyRouter);
app.use('/api/batch', authMiddleware, batchRouter);
app.use('/api/pptx', authMiddleware, pptxRouter);

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Default password: ${process.env.APP_PASSWORD || 'beautify123'}`);
});
