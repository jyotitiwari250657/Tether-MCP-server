// Vercel Serverless Function entrypoint for /.well-known (<= 50 lines)
import { getRequestListener } from '@hono/node-server';
import { app } from '../src/index.js';

export default getRequestListener(app.fetch);
