import {
  SILENCE_RESET_MS,
  SPEAKING_RMS_THRESHOLD,
  VAD_SAMPLE_INTERVAL_MS,
} from "../config";
import { SpeechState } from "../types";

/** Resume AudioContext after user gesture (required by browser autoplay policy). */
export async function resume_audio_context(ctx: AudioContext): Promise<void> {
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

/** Compute normalized RMS from AnalyserNode time-domain data. */
export function sample_rms(analyser: AnalyserNode): number {
  const data = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i];
  }
  return Math.sqrt(sum / data.length);
}

/** Attack immediate; release debounced per SILENCE_RESET_MS. */
export function debounce_speech_state(
  rms: number,
  prev: SpeechState,
  silenceStartedMs: number | null,
  nowMs: number,
): { state: SpeechState; silenceStartedMs: number | null } {
  const aboveThreshold = rms > SPEAKING_RMS_THRESHOLD;

  if (aboveThreshold) {
    return { state: SpeechState.Speaking, silenceStartedMs: null };
  }

  if (prev === SpeechState.Silent) {
    return { state: SpeechState.Silent, silenceStartedMs: nowMs };
  }

  const started = silenceStartedMs ?? nowMs;
  if (nowMs - started >= SILENCE_RESET_MS) {
    return { state: SpeechState.Silent, silenceStartedMs: started };
  }

  return { state: SpeechState.Speaking, silenceStartedMs: started };
}

/** Opens the mic and emits debounced Speaking/Silent transitions via Web Audio VAD. */
export class SpeechDetector {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private sampleTimer: ReturnType<typeof setInterval> | null = null;
  private speechState = SpeechState.Silent;
  private silenceStartedMs: number | null = null;
  private onStateChange: ((state: SpeechState) => void) | null = null;

  /** Acquire mic, start AnalyserNode loop; throws on permission or device errors. */
  async start(onStateChange: (state: SpeechState) => void): Promise<void> {
    this.stop();
    this.onStateChange = onStateChange;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.audioContext = new AudioContext();
      await resume_audio_context(this.audioContext);

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);

      this.speechState = SpeechState.Silent;
      this.silenceStartedMs = null;
      this.emit_state(SpeechState.Silent);

      // TODO(#1): Add calibration UI or auto-calibrate ambient noise floor on Start.
      // Default SPEAKING_RMS_THRESHOLD may false-trigger in noisy rooms.

      this.sampleTimer = setInterval(() => {
        if (!this.analyser) return;
        const nowMs = performance.now();
        const rms = sample_rms(this.analyser);
        const result = debounce_speech_state(
          rms,
          this.speechState,
          this.silenceStartedMs,
          nowMs,
        );
        this.silenceStartedMs = result.silenceStartedMs;
        if (result.state !== this.speechState) {
          this.speechState = result.state;
          this.emit_state(result.state);
        }
      }, VAD_SAMPLE_INTERVAL_MS);
    } catch (err) {
      this.stop();
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          throw new Error("Microphone permission denied");
        }
        if (err.name === "NotFoundError") {
          throw new Error("No microphone found");
        }
      }
      throw err;
    }
  }

  /** Stop tracks and close AudioContext. */
  stop(): void {
    if (this.sampleTimer !== null) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.onStateChange = null;
    this.speechState = SpeechState.Silent;
    this.silenceStartedMs = null;
  }

  getSpeechState(): SpeechState {
    return this.speechState;
  }

  private emit_state(state: SpeechState): void {
    this.onStateChange?.(state);
  }
}
