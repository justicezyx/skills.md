import { CRITICAL_MONOLOG_MS, WARN_MONOLOG_MS } from "../config";
import { MonologLevel } from "../types";

/** Format ms as m:ss (floor seconds). */
export function format_duration(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Map monolog duration to Safe | Warning | Critical (inclusive lower bounds). */
export function monolog_level_for(ms: number): MonologLevel {
  if (ms >= CRITICAL_MONOLOG_MS) {
    return MonologLevel.Critical;
  }
  if (ms >= WARN_MONOLOG_MS) {
    return MonologLevel.Warning;
  }
  return MonologLevel.Safe;
}
