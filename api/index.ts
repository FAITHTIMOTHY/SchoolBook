// @ts-nocheck
/**
 * Vercel Serverless Function entrypoint.
 *
 * Automatically detected by Vercel inside the api/ directory.
 * Routes requests to the lazy-initialized NestJS application.
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

