import { SpeechDetector } from "../audio/SpeechDetector";
import {
  SessionSnapshot,
  SessionState,
  SessionSummary,
  SpeechState,
} from "../types";
import { empty_monolog_snapshot, MonologTracker } from "../tracking/MonologTracker";

/** Orchestrates session clock, VAD, and monolog tracker; single source of session truth. */
export class InterviewSession {
  private sessionState = SessionState.Idle;
  private startedAtMs: number | null = null;
  private endedAtMs: number | null = null;
  private speechState = SpeechState.Silent;
  private readonly tracker = new MonologTracker();
  private readonly detector = new SpeechDetector();
  private frozenMonolog = empty_monolog_snapshot();

  /** Start mic + timers; idempotent from Idle only. */
  async start(): Promise<void> {
    if (this.sessionState !== SessionState.Idle) {
      return;
    }

    this.tracker.reset();
    this.speechState = SpeechState.Silent;
    this.frozenMonolog = empty_monolog_snapshot();

    try {
      await this.detector.start((state) => {
        this.on_speech_state_change(state);
      });
    } catch (err) {
      this.detector.stop();
      throw err;
    }

    this.startedAtMs = performance.now();
    this.endedAtMs = null;
    this.sessionState = SessionState.Running;
  }

  /** Stop mic, freeze stats, transition to Ended. */
  stop(): SessionSummary {
    if (this.sessionState !== SessionState.Running) {
      return this.build_summary();
    }

    this.detector.stop();
    this.endedAtMs = performance.now();
    this.frozenMonolog = this.tracker.tick(this.endedAtMs, this.speechState);
    this.sessionState = SessionState.Ended;

    return this.build_summary();
  }

  /** Return to Idle after Ended; enables another interview. */
  reset_to_idle(): void {
    if (this.sessionState !== SessionState.Ended) {
      return;
    }

    this.sessionState = SessionState.Idle;
    this.startedAtMs = null;
    this.endedAtMs = null;
    this.speechState = SpeechState.Silent;
    this.tracker.reset();
    this.frozenMonolog = empty_monolog_snapshot();
  }

  /** Poll for UI render loop (~60fps). */
  getSnapshot(): SessionSnapshot {
    const nowMs = performance.now();

    if (this.sessionState === SessionState.Idle) {
      return {
        sessionState: SessionState.Idle,
        totalElapsedMs: 0,
        monolog: empty_monolog_snapshot(),
      };
    }

    if (this.sessionState === SessionState.Ended) {
      return {
        sessionState: SessionState.Ended,
        totalElapsedMs: this.elapsed_ms(nowMs),
        monolog: this.frozenMonolog,
      };
    }

    return {
      sessionState: SessionState.Running,
      totalElapsedMs: this.elapsed_ms(nowMs),
      monolog: this.tracker.tick(nowMs, this.speechState),
    };
  }

  getSessionState(): SessionState {
    return this.sessionState;
  }

  private on_speech_state_change(state: SpeechState): void {
    this.speechState = state;
  }

  private elapsed_ms(nowMs: number): number {
    if (this.startedAtMs === null) return 0;
    const end = this.endedAtMs ?? nowMs;
    return end - this.startedAtMs;
  }

  private build_summary(): SessionSummary {
    const nowMs = performance.now();
    const peak = Math.max(this.tracker.getPeakMonologMs(), this.frozenMonolog.peakMonologMs);
    return {
      totalElapsedMs: this.elapsed_ms(nowMs),
      peakMonologMs: peak,
    };
  }

  // TODO(#2): Support Pause — freeze started_at anchor and pause VAD sampling.
}
