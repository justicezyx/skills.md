import { InterviewSession } from "./session/InterviewSession";
import { SessionState } from "./types";
import { TimerDisplay, TimerDisplayElements } from "./ui/TimerDisplay";

let renderLoopId: number | null = null;

function query_elements(): TimerDisplayElements {
  const btnStart = document.getElementById("btn-start-interview");
  const btnStop = document.getElementById("btn-stop");
  const btnNewInterview = document.getElementById("btn-new-interview");
  const clockElapsed = document.getElementById("clock-elapsed");
  const clockMonolog = document.getElementById("clock-monolog");
  const monologRing = document.getElementById("monolog-ring");
  const errorMsg = document.getElementById("error-msg");
  const summaryPanel = document.getElementById("summary-panel");
  const summaryElapsed = document.getElementById("summary-elapsed");
  const summaryPeak = document.getElementById("summary-peak");

  if (
    !btnStart ||
    !btnStop ||
    !btnNewInterview ||
    !clockElapsed ||
    !clockMonolog ||
    !monologRing ||
    !errorMsg ||
    !summaryPanel ||
    !summaryElapsed ||
    !summaryPeak
  ) {
    throw new Error("Missing required DOM elements");
  }

  return {
    btnStart: btnStart as HTMLButtonElement,
    btnStop: btnStop as HTMLButtonElement,
    btnNewInterview: btnNewInterview as HTMLButtonElement,
    clockElapsed,
    clockMonolog,
    monologRing,
    errorMsg,
    summaryPanel,
    summaryElapsed,
    summaryPeak,
  };
}

function start_render_loop(session: InterviewSession, display: TimerDisplay): void {
  stop_render_loop();
  const tick = () => {
    display.render(session.getSnapshot());
    renderLoopId = requestAnimationFrame(tick);
  };
  renderLoopId = requestAnimationFrame(tick);
}

function stop_render_loop(): void {
  if (renderLoopId !== null) {
    cancelAnimationFrame(renderLoopId);
    renderLoopId = null;
  }
}

function wire_start_button(
  session: InterviewSession,
  display: TimerDisplay,
  els: TimerDisplayElements,
): void {
  els.btnStart.addEventListener("click", async () => {
    if (session.getSessionState() !== SessionState.Idle) {
      return;
    }

    els.btnStart.disabled = true;
    display.hide_error();

    try {
      await session.start();
      display.show_running();
      start_render_loop(session, display);
    } catch (err) {
      els.btnStart.disabled = false;
      const message = err instanceof Error ? err.message : "Failed to start microphone";
      display.show_error(message);
    }
  });
}

function wire_stop_button(
  session: InterviewSession,
  display: TimerDisplay,
  els: TimerDisplayElements,
): void {
  els.btnStop.addEventListener("click", () => {
    stop_render_loop();
    const summary = session.stop();
    display.render(session.getSnapshot());
    display.show_summary(summary);
  });
}

function wire_new_interview_button(
  session: InterviewSession,
  display: TimerDisplay,
  els: TimerDisplayElements,
): void {
  els.btnNewInterview.addEventListener("click", () => {
    session.reset_to_idle();
    display.show_idle();
  });
}

function bootstrap_app(): void {
  const els = query_elements();
  const display = new TimerDisplay(els);
  const session = new InterviewSession();

  display.show_idle();
  wire_start_button(session, display, els);
  wire_stop_button(session, display, els);
  wire_new_interview_button(session, display, els);

  // TODO(#3): Optional audio/haptic nudge at Warning and Critical transitions.
}

bootstrap_app();
