# Phase 13 voice setup

## Configure Gnani locally

1. Copy `backend/.env.example` to `backend/.env`.
2. Open `backend/.env` in VS Code and replace the `GNANI_API_KEY` placeholder with a Speech API key from your Gnani dashboard. Keep the value on your computer; do not send it in chat or add it to source control.
3. Optionally change `GNANI_TIMBRE_VOICE` to a Timbre v3.0 voice available to your account. The default is `Shivani`.
4. Start the backend in one terminal: `cd backend` then `npm run dev`.
5. Start the game in another terminal: `cd frontend` then `npm run dev`.
6. Open the local Vite URL, enter the Phaser mission, and allow microphone access when prompted. Recording stops automatically after 30 seconds; select **Stop & send** to finish earlier.

The frontend sends audio to the same-origin `/api` route. Vite proxies those requests to the local backend, which is bound to `127.0.0.1`. Gnani credentials are read only by the backend and are never sent to the browser.

## Current behavior and limits

- Prisma v3.0 transcribes mono 16 kHz WAV clips of up to 30 seconds.
- Timbre v3.0 speaks a clearly labeled acknowledgment of the recognized transcript. Generated WAV playback uses the shared game audio manager and follows the game's master mute/volume settings.
- Evon intent interpretation is not connected. Gnani's official public API documentation inspected for this phase does not describe an Evon game-conversation endpoint. Speech does not trigger gameplay actions until an official contract and safe action mapping are implemented.
- Microphone access requires a secure browser context; localhost is accepted by modern browsers. The backend is development-local and should sit behind HTTPS and suitable origin controls if deployed.

## Backend API

- `GET /api/health`: reports whether a key is configured and marks Evon pending.
- `POST /api/voice/transcribe`: accepts a WAV request body and returns the transcript plus detected language and request ID.
- `POST /api/voice/speak`: accepts `{ "text": "...", "language": "auto" }` and returns generated WAV bytes.

The root `.gitignore` excludes `.env` files and keeps `.env.example` templates eligible for source control. This workspace currently has no Git repository metadata, so Git tracking could not be inspected here.
