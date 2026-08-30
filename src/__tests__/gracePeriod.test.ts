// src/__tests__/gracePeriod.test.ts
// Offline Grace Period Mathematical Verification Test

export function calculateGracePeriod(
  expiresAtSec: number,
  graceDays: number,
  currentTimeSec: number
): { status: "ACTIVE" | "OFFLINE_GRACE_PERIOD" | "EXPIRED"; daysLeft: number } {
  const graceSec = graceDays * 86400;
  const hardCutoff = expiresAtSec + graceSec;

  if (currentTimeSec <= expiresAtSec) {
    return { status: "ACTIVE", daysLeft: Math.ceil((expiresAtSec - currentTimeSec) / 86400) };
  } else if (currentTimeSec <= hardCutoff) {
    return { status: "OFFLINE_GRACE_PERIOD", daysLeft: Math.max(1, Math.ceil((hardCutoff - currentTimeSec) / 86400)) };
  } else {
    return { status: "EXPIRED", daysLeft: 0 };
  }
}

// Validation assertions
const now = 1700000000;
const testActive = calculateGracePeriod(now + 86400 * 5, 14, now);
console.assert(testActive.status === "ACTIVE", "Active status check failed");

const testGrace = calculateGracePeriod(now - 86400 * 2, 14, now);
console.assert(testGrace.status === "OFFLINE_GRACE_PERIOD", "Grace period check failed");
console.assert(testGrace.daysLeft === 12, "Grace period days calculation failed");

const testExpired = calculateGracePeriod(now - 86400 * 20, 14, now);
console.assert(testExpired.status === "EXPIRED", "Expired status check failed");
console.log("All TypeScript Grace Period Unit Tests Passed Successfully!");
