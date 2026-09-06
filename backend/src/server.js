import 'dotenv/config';
import { app } from './app.js';
import { initializeDatabase, pool } from './config/db.js';

const port = Number(process.env.PORT) || 4000;

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'development-only-change-me';
  console.warn('JWT_SECRET is not set; using an insecure development fallback.');
}

initializeDatabase()
  .then(() => app.listen(port, () => console.log(`Orbit API listening at http://localhost:${port}`)))
  .catch((error) => {
    console.error('Could not initialize the database:', error.message);
    process.exit(1);
  });

process.on('SIGTERM', () => pool.end());
