import { Worker as ThreadWorker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ThreadMessage } from '../util/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function runCpuThread(scriptPath = '', limit = 100000): Promise<number> {
  return new Promise((resolve, reject) => {
    //  path resolution execution from compiled/dist structure or src
    const resolvedPath = path.isAbsolute(scriptPath)
      ? scriptPath
      : path.resolve(__dirname, '../', scriptPath);

    const thread = new ThreadWorker(resolvedPath, {
      workerData: { limit },
    });

    thread.on('message', (msg: ThreadMessage) => resolve(msg.result));
    thread.on('error', reject);
    thread.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Thread exited with code ${code}`));
    });
  });
}
