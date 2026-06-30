import 'dotenv/config';
import express from 'express';
import { redisConnection } from './connection/redis.js';
import { buildMetricsText } from './lib/metrics.js';
import { WORKER_PORT } from './util/constants.js';
import { bullRedis, logTarget } from './connection/bullRedis.js';
import { queueWorker } from './threads/queueWorker.js';

const app = express();

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', worker: 'active' });
});

// Prometheus Metrics Endpoints
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.status(200).send(await buildMetricsText());
  } catch (err) {
    console.error('[METRICS_ENDPOINT_ERROR]', err);
    res.status(500).send('Error rendering metrics');
  }
});

app.listen(WORKER_PORT, () => {
  console.warn(`[SYSTEM] Worker runtime actively listening on port ${WORKER_PORT}`);
  console.warn(`[SYSTEM] Monitoring BullMQ queue targeting cluster Redis via ${logTarget}`);
});

// Graceful Shutdown Handler
const shutdown = async (signal = 'SIGTERM') => {
  console.warn(`[SHUTDOWN] Received ${signal}. Starting graceful cleanup...`);

  await queueWorker.close();
  console.warn('[SHUTDOWN] BullMQ worker closed.');

  await bullRedis.quit();
  console.warn('[SHUTDOWN] BullMQ Redis connection closed.');

  await redisConnection.quit();
  console.warn('[SHUTDOWN] Metrics Redis connection closed.');

  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
