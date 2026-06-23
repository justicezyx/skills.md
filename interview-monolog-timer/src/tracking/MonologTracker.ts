import { MonologLevel, MonologSnapshot, SpeechState } from "../types";
import { monolog_level_for } from "../util/time";

/** Tracks continuous monolog duration and peak; resets after sustained silence. */
export class MonologTracker {
  private currentMonologMs = 0;
  private peakMonologMs = 0;
  private lastTickMs: number | null = null;

  /** Call on each render tick while Running with debounced speech state. */
  tick(nowMs: number, speech: SpeechState): MonologSnapshot {
    this.accumulate_monolog(nowMs, speech);
    return {
      currentMonologMs: this.currentMonologMs,
      peakMonologMs: this.peakMonologMs,
      level: monolog_level_for(this.currentMonologMs),
    };
  }

  /** Reset counters for a new session. */
  reset(): void {
    this.currentMonologMs = 0;
    this.peakMonologMs = 0;
    this.lastTickMs = null;
  }

  /** Delta-time accumulation; only increments while Speaking. */
  private accumulate_monolog(nowMs: number, speech: SpeechState): void {
    if (speech === SpeechState.Silent) {
      this.currentMonologMs = 0;
      this.lastTickMs = null;
      return;
    }

    if (this.lastTickMs === null) {
      this.lastTickMs = nowMs;
      return;
    }

    const delta = nowMs - this.lastTickMs;
    this.currentMonologMs += delta;
    if (this.currentMonologMs > this.peakMonologMs) {
      this.peakMonologMs = this.currentMonologMs;
    }
    this.lastTickMs = nowMs;
  }

  /** Frozen peak at session end. */
  getPeakMonologMs(): number {
    return this.peakMonologMs;
  }
}

/** @internal Exported for unit tests (issue #4). */
export function empty_monolog_snapshot(): MonologSnapshot {
  return {
    currentMonologMs: 0,
    peakMonologMs: 0,
    level: MonologLevel.Safe,
  };
}
