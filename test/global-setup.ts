import {
  MariaDbContainer,
  StartedMariaDbContainer,
} from '@testcontainers/mariadb';
import { runMigrations } from '../src/infrastructure/database/database.js';

let container: StartedMariaDbContainer;

// One throwaway MariaDB per e2e run, migrated exactly like production.
export async function setup(): Promise<void> {
  container = await new MariaDbContainer('mariadb:11.8').start();
  const url = container.getConnectionUri();
  await runMigrations(url);
  // Test workers are spawned after global setup and inherit this env.
  process.env.DATABASE_URL = url;
}

export async function teardown(): Promise<void> {
  await container?.stop();
}
