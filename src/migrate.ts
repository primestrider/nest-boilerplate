// Applies pending migrations without dev dependencies: `node dist/migrate.js`.
import { validateEnv } from './config/env.js';
import { runMigrations } from './infrastructure/database/database.js';

try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the real environment (e.g. in containers).
}

const env = validateEnv(process.env);
await runMigrations(env.DATABASE_URL);
console.log('Migrations applied');
