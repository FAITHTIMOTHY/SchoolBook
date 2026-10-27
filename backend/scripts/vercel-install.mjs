console.error(`
================================================================================
CONFIGURATION ERROR: VERCEL ROOT DIRECTORY IS SET TO 'backend'
================================================================================
Vercel is currently executing inside the 'backend' folder because Root Directory
is configured as 'backend' in your Vercel Project Settings.

SchoolBook requires the Root Directory to be the repository root because:
1. The frontend assets and build scripts reside at the root (src/frontend, package.json).
2. The Vercel serverless function entrypoint is at src/app.ts.

HOW TO FIX IN 30 SECONDS:
1. In your Vercel Dashboard, go to Settings -> General.
2. Find 'Root Directory' (it currently says 'backend').
3. Click 'Edit', delete 'backend' so the input is completely empty (or reset to root).
4. Click 'Save'.
5. Go to the Deployments tab and click 'Redeploy' on the latest deployment.
================================================================================
`);
process.exit(1);

