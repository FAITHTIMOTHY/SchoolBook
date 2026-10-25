import { spawnSync } from 'node:child_process';

if (process.env.RUN_MIGRATIONS !== '1') {
  console.log('Skipping database migrations (set RUN_MIGRATIONS=1 to enable).');
  process.exit(0);
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['run', 'prisma:migrate', '--prefix', 'backend'], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
