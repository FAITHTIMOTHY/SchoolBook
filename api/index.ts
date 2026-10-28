// @ts-nocheck
import path from 'node:path';
import module from 'node:module';
import express from 'express';

// Add backend/node_modules to module search path for Vercel Serverless environment
try {
  const backendModules = path.resolve(process.cwd(), 'backend', 'node_modules');
  if (module.Module && Array.isArray(module.Module.globalPaths)) {
    if (!module.Module.globalPaths.includes(backendModules)) {
      module.Module.globalPaths.push(backendModules);
    }
  }
} catch {
  // Ignore fallback errors
}

const server = express();
let appInitPromise: Promise<any> | null = null;
let appInitError: any = null;

server.use(async (req, res, next) => {
  if (appInitError) {
    return res.status(500).json({
      error: 'SERVERLESS_INIT_ERROR',
      message: appInitError?.message || String(appInitError),
      stack: appInitError?.stack,
    });
  }

  if (!appInitPromise) {
    appInitPromise = (async () => {
      try {
        const { createApp } = await import('../backend/dist/app.setup.js');
        const app = await createApp(server);
        await app.init();
        return app;
      } catch (err: any) {
        appInitError = err;
        console.error('NestJS Serverless Init Failed:', err);
        throw err;
      }
    })();
  }

  try {
    await appInitPromise;
    next();
  } catch (err: any) {
    return res.status(500).json({
      error: 'SERVERLESS_INIT_ERROR',
      message: err?.message || String(err),
      stack: err?.stack,
    });
  }
});

// Fallback error handler
server.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled Serverless Error:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    error: 'UNHANDLED_SERVERLESS_ERROR',
    message: err?.message || String(err),
    stack: err?.stack,
  });
});

export default server;
