import { parentPort, workerData } from 'worker_threads';

function calculatePrimesCount(limit) {
  const isPrime = Array(limit + 1).fill(true);
  isPrime[0] = isPrime[1] = false;

  for (let i = 2; i <= Math.sqrt(limit); i++) {
    if (isPrime[i]) {
      for (let j = i * i; j <= limit; j += i) {
        isPrime[j] = false;
      }
    }
  }

  return isPrime.filter(Boolean).length;
}

const { limit } = workerData;
const totalPrimesFound = calculatePrimesCount(limit);
parentPort.postMessage({ result: totalPrimesFound });
