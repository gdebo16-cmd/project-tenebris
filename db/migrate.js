// Runs database migrations with node-pg-migrate, using DATABASE_URL from the root .env.
//
//   npm run migrate            apply every migration that hasn't run yet
//   npm run migrate -- down    undo the most recent migration
//   npm run migrate -- fake    mark every pending migration as run WITHOUT running it
//                              (only for a database that already has those tables,
//                              e.g. adopting the baseline on `rework`)
//
// New migration files: npm run migrate:create -- <name>
import { runner } from 'node-pg-migrate';

try { process.loadEnvFile('.env'); } catch {}

const command = process.argv[2] ?? 'up';
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (check your .env)');

// Safety net: refuse to touch the live database unless you really mean it.
const PRODUCTION_ENDPOINT = 'ep-plain-sky-ar7ksy36';
if (url.includes(PRODUCTION_ENDPOINT) && process.env.ALLOW_PRODUCTION !== 'yes') {
  throw new Error('DATABASE_URL points at PRODUCTION. Set ALLOW_PRODUCTION=yes if you really mean it.');
}

const host = new URL(url).hostname.split('.')[0];
console.log(`migrate ${command} on ${host}`);

await runner({
  databaseUrl: url,
  dir: 'db/migrations',
  migrationsTable: 'pgmigrations',
  direction: command === 'down' ? 'down' : 'up',
  count: command === 'down' ? 1 : Infinity,
  fake: command === 'fake',
  checkOrder: true,
  log: (msg) => console.log(msg),
});
