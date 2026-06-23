# Demo recordings

Screen recordings of the Interview Monolog Timer browser smoke test.

## Files

| File | Format | Use case |
|------|--------|----------|
| `interview-monolog-timer-demo.mp4` | Full screen (~3024×1964, 38s) | Original capture |
| `interview-monolog-timer-demo-1080p.mp4` | 1920px wide landscape | **LinkedIn, X, YouTube** |
| `interview-monolog-timer-demo-square.mp4` | 1080×1080 square | **Instagram feed, Threads** |

## What the demo shows

1. Idle state — monolog clock at 0:00
2. **Start Interview** — elapsed timer runs, VAD tracks speaking
3. **Stop** — session summary (total time + longest monolog)
4. **New Interview** — reset and second session

## Re-record

```bash
# Terminal 1
cd interview-monolog-timer && npm run preview

# Terminal 2 (requires Screen Recording permission for Terminal/Cursor)
ffmpeg -f avfoundation -capture_cursor 1 -pixel_format uyvy422 -framerate 30 -t 40 \
  -i "1:none" -c:v libx264 -crf 20 -pix_fmt yuv420p demo/interview-monolog-timer-demo.mp4
```

Open http://localhost:4173/ in the browser before recording.
