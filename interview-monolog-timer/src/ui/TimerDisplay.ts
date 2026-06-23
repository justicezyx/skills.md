import { MonologLevel, SessionSnapshot, SessionState, SessionSummary } from "../types";
import { format_duration } from "../util/time";

export interface TimerDisplayElements {
  btnStart: HTMLButtonElement;
  btnStop: HTMLButtonElement;
  btnNewInterview: HTMLButtonElement;
  clockElapsed: HTMLElement;
  clockMonolog: HTMLElement;
  monologRing: HTMLElement;
  errorMsg: HTMLElement;
  summaryPanel: HTMLElement;
  summaryElapsed: HTMLElement;
  summaryPeak: HTMLElement;
}

/** Renders elapsed + monolog clocks and applies level-based CSS classes. */
export class TimerDisplay {
  constructor(private readonly els: TimerDisplayElements) {}

  render(snapshot: SessionSnapshot): void {
    this.els.clockElapsed.textContent = format_duration(snapshot.totalElapsedMs);
    this.els.clockMonolog.textContent = format_duration(snapshot.monolog.currentMonologMs);

    this.els.monologRing.classList.remove("level-safe", "level-warning", "level-critical");
    this.els.monologRing.classList.add(`level-${snapshot.monolog.level}`);
  }

  show_error(message: string): void {
    this.els.errorMsg.textContent = message;
    this.els.errorMsg.classList.remove("hidden");
  }

  hide_error(): void {
    this.els.errorMsg.textContent = "";
    this.els.errorMsg.classList.add("hidden");
  }

  show_summary(summary: SessionSummary): void {
    this.els.summaryElapsed.textContent = format_duration(summary.totalElapsedMs);
    this.els.summaryPeak.textContent = format_duration(summary.peakMonologMs);
    this.els.summaryPanel.classList.remove("hidden");
    this.show_ended();
  }

  show_idle(): void {
    this.els.btnStart.disabled = false;
    this.els.btnStart.classList.remove("hidden");
    this.els.btnStop.disabled = true;
    this.els.btnNewInterview.classList.add("hidden");
    this.els.summaryPanel.classList.add("hidden");
    this.render({
      sessionState: SessionState.Idle,
      totalElapsedMs: 0,
      monolog: { currentMonologMs: 0, peakMonologMs: 0, level: MonologLevel.Safe },
    });
  }

  show_running(): void {
    this.els.btnStart.disabled = true;
    this.els.btnStop.disabled = false;
    this.els.btnNewInterview.classList.add("hidden");
    this.els.summaryPanel.classList.add("hidden");
    this.hide_error();
  }

  show_ended(): void {
    this.els.btnStart.classList.add("hidden");
    this.els.btnStop.disabled = true;
    this.els.btnNewInterview.classList.remove("hidden");
  }
}
