// Derives a SQLite variant of the canonical schema for fast local/CI runs.
// The datasource `provider` cannot be an env var, so we generate a sibling schema
// with provider=sqlite, then push + generate the client from it.
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(apiDir, 'prisma', 'schema.prisma');
const out = join(apiDir, 'prisma', 'schema.sqlite.prisma');

let schema = readFileSync(src, 'utf8');
schema = schema.replace(/provider\s*=\s*"postgresql"/, 'provider = "sqlite"');
writeFileSync(out, schema);

const url = process.env.SQLITE_URL ?? 'file:./dev.db';
const env = { ...process.env, DATABASE_URL: url };
console.log(`SQLite schema → ${out}\nDATABASE_URL=${url}`);

execSync(`pnpm exec prisma db push --accept-data-loss --skip-generate --schema "${out}"`, {
  cwd: apiDir,
  env,
  stdio: 'inherit',
});
execSync(`pnpm exec prisma generate --schema "${out}"`, { cwd: apiDir, env, stdio: 'inherit' });
console.log('\nSQLite ready. Run the API/tests with DATABASE_URL=' + url);
