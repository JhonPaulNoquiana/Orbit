import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspaces.js';
import boardRoutes from './routes/boards.js';
import { authenticate } from './middleware/auth.js';

export const app = express();

app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', authenticate, workspaceRoutes);
app.use('/api/boards', authenticate, boardRoutes);

if (process.env.NODE_ENV === 'production') {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const frontendDirectory = path.resolve(currentDirectory, '../../frontend/dist');
  app.use(express.static(frontendDirectory));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(frontendDirectory, 'index.html'));
    }
    next();
  });
}

app.use((req, res) => res.status(404).json({ message: `Route ${req.method} ${req.path} not found` }));
app.use((error, _req, res, _next) => {
  const status = error.status || (error.code === '23505' ? 409 : error.code?.startsWith?.('23') ? 400 : 500);
  if (status === 500) console.error(error);
  res.status(status).json({ message: status === 500 ? 'Something went wrong on the server' : error.message });
});
