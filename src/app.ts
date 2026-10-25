// @ts-nocheck
/**
 * Vercel entrypoint.
 *
 * Vercel runs backend applications as a single Vercel Function. It detects the
 * default-exported Express instance in this file and forwards every request to
 * it. Nest is initialised lazily on the first request so a cold start cannot
 * fail at module load time.
 *
 * This file is only used on Vercel. The standalone server (`backend/src/main.ts`)
 * is still the entrypoint for Docker, Render, and local development.
 */
import express from 'express';
import { createApp } from '../backend/dist/app.setup.js';

const server = express();
let initialised = null;

server.use((req, res, next) => {
  if (!initialised) {
    initialised = createApp(server)
      .then((app) => app.init())
      .catch((error) => {
        initialised = null;
        throw error;
      });
  }

  initialised.then(() => next(), next);
});

export default server;
