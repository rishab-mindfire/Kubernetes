import { parentPort, workerData } from 'worker_threads';

function calculatePrimes(limit: number): number {
  if (limit < 2) return 0;
  let count = 1;

  for (let i = 3; i <= limit; i += 2) {
    let isPrime = true;
    const maxCheck = Math.sqrt(i);
    for (let j = 3; j <= maxCheck; j += 2) {
      if (i % j === 0) {
        isPrime = false;
        break;
      }
    }
    if (isPrime) count++;
  }
  return count;
}

// Compute synchronously to pin the allocated CPU core
const totalPrimes = calculatePrimes(workerData.limit);

// Return result back to main cluster pipeline
parentPort?.postMessage({ success: true, count: totalPrimes });
