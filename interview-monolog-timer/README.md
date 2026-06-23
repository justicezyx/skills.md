# Interview Monolog Timer

Track how long you've been speaking continuously during an interview, so you don't dominate the conversation.

## Requirements

- Node.js 18+
- Modern browser with microphone support (Chrome, Firefox, or Safari)
- Localhost or HTTPS (required for microphone access)

## Setup

```bash
cd interview-monolog-timer
npm install
```

## Run

```bash
npm run dev
```

Open http://localhost:5173

## Usage

1. Click **Start Interview** and grant microphone permission
2. Watch the **Current monolog** clock — it counts while you speak
3. Pause ~1 second to reset the monolog counter
4. Amber ring at 30s; red pulse at 60s of uninterrupted speech
5. Click **Stop** to see session summary
6. Click **New Interview** to start another session

## How it works

- Uses microphone volume (VAD) only — no speech-to-text, no cloud, no network requests
- Monolog resets after 1.2s of silence; brief breath pauses won't reset
- **Interview elapsed** keeps running for the whole session

## Microphone assumption

This app monitors **your microphone only**. It cannot distinguish speakers if multiple people share one mic. Designed for: my mic = my airtime.

## Noisy environments

If the monolog clock runs while you're silent, ambient noise may be above the detection threshold. VAD calibration is planned (see GitHub issues).

## Build

```bash
npm run build
npm run preview
```

## References

- Warn threshold: 30s continuous monolog
- Critical threshold: 60s continuous monolog
