import fs from 'node:fs';
import { execSync } from 'node:child_process';

console.log('--- SchoolBook Vercel Install Step ---');
console.log('Current working directory:', process.cwd());

if (!fs.existsSync('src/app.ts') || !fs.existsSync('backend/package-lock.json')) {
  console.error(
    'ERROR: Vercel Root Directory must be the repository root, not backend. ' +
    'Set Project Settings > Build and Deployment > Root Directory to the repository root, then redeploy.',
  );
  process.exit(1);
}

function runCommand(command, envOverrides = {}) {
  console.log(`\n> ${command}`);
  try {
    execSync(command, {
      stdio: 'inherit',
      env: { ...process.env, ...envOverrides },
    });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    if (error.message) console.error(error.message);
    throw error;
  }
}

try {
  // 1. Install root dependencies (with fallback to npm install if ci lockfile differs)
  try {
    runCommand('npm ci --include=dev');
  } catch {
    console.warn('npm ci failed at root, falling back to npm install --include=dev...');
    runCommand('npm install --include=dev');
  }

  // 2. Install backend dependencies (with fallback to npm install)
  try {
    runCommand('npm ci --include=dev --prefix backend');
  } catch {
    console.warn('npm ci failed in backend, falling back to npm install --include=dev --prefix backend...');
    runCommand('npm install --include=dev --prefix backend');
  }

  // 3. Generate Prisma client
  const dbFallback = 'postgresql://build:build@127.0.0.1:5432/build';
  runCommand('npm run prisma:generate --prefix backend', {
    DATABASE_URL: process.env.DATABASE_URL || dbFallback,
    DIRECT_URL: process.env.DIRECT_URL || dbFallback,
  });

  console.log('\n--- Vercel Install Step Completed Successfully ---');
} catch (err) {
  console.error('\nVercel install failed:', err);
  process.exit(1);
}
