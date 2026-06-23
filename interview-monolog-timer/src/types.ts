/** Lifecycle of one interview run from the user's perspective. */
export enum SessionState {
  Idle = "idle",
  Running = "running",
  Ended = "ended",
}

/** Microphone-derived voice activity, debounced for silence. */
export enum SpeechState {
  Silent = "silent",
  Speaking = "speaking",
}

/** How urgent the current uninterrupted monolog is. */
export enum MonologLevel {
  Safe = "safe",
  Warning = "warning",
  Critical = "critical",
}

export interface MonologSnapshot {
  currentMonologMs: number;
  peakMonologMs: number;
  level: MonologLevel;
}

export interface SessionSummary {
  totalElapsedMs: number;
  peakMonologMs: number;
}

export interface SessionSnapshot {
  sessionState: SessionState;
  totalElapsedMs: number;
  monolog: MonologSnapshot;
}
