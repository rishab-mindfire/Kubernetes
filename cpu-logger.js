/* eslint-disable no-undef */
import os from 'os';

function getCPUInfo() {
  const cpus = os.cpus();
  let totalMs = 0;
  let idleMs = 0;

  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalMs += cpu.times[type];
    }
    idleMs += cpu.times.idle;
  });

  return { totalMs, idleMs };
}

let startState = getCPUInfo();

console.log('Monitoring CPU (ESM Version)... Press Ctrl+C to stop.\n');

setInterval(() => {
  const endState = getCPUInfo();
  const totalDifference = endState.totalMs - startState.totalMs;
  const idleDifference = endState.idleMs - startState.idleMs;

  if (totalDifference > 0) {
    const averageUsagePercentage = 100 - Math.floor((100 * idleDifference) / totalDifference);
    console.log(
      `[${new Date().toLocaleTimeString()}] Average CPU Utilization: ${averageUsagePercentage}%`
    );
  }
  startState = endState;
}, 2000);
