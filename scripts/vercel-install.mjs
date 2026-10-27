import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

if (!fs.existsSync('src/app.ts') || !fs.existsSync('backend/package-lock.json')) {
  console.error(
    'ERROR: Vercel Root Directory must be the repository root, not backend. ' +
    'Set Project Settings > Build and Deployment > Root Directory to the repository root, then redeploy.',
  );
  process.exit(1);
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(cmd, args, extraEnv = {}) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// 1. Install root dependencies (including devDependencies for esbuild)
console.log('Installing root dependencies...');
run(npm, ['ci', '--include=dev']);

// 2. Install backend dependencies (including devDependencies for Nest CLI and Prisma)
console.log('Installing backend dependencies...');
run(npm, ['ci', '--include=dev', '--prefix', 'backend']);

// 3. Generate Prisma client (provide build fallbacks if URLs not yet injected)
console.log('Generating Prisma client...');
run(npm, ['run', 'prisma:generate', '--prefix', 'backend'], {
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://build:build@127.0.0.1:5432/build',
  DIRECT_URL: process.env.DIRECT_URL || 'postgresql://build:build@127.0.0.1:5432/build',
});

