# Animal Detector

Take or choose a photo of an animal or plant, and the app tells you what it is: common name, scientific name, classification, habitat, safety warnings and more.

- `src/` is the mobile app (Expo / React Native, iOS and Android).
- `backend/` is a small Cloudflare Worker. It holds the API keys and does the identification, so no keys ship inside the app.

## How identification works

1. The app shrinks the photo and sends it to the backend.
2. The backend asks Claude (a vision AI) to identify it and write the info. In Plant mode it first asks Pl@ntNet, a specialist plant classifier, and passes its suggestions along.
3. The scientific name is checked against GBIF (the global species database) for the official name and classification.
4. A short description and reference photo come from Wikipedia.

## One-time setup

You need [Node.js](https://nodejs.org) (version 20 or newer) installed on your computer.

### 1. Get the code and install

```bash
git clone https://github.com/arafat28xx/animal-detector.git
cd animal-detector
npm install
cd backend && npm install && cd ..
```

### 2. Start the backend

1. Optional: get a Claude API key at https://console.anthropic.com (Settings → API Keys). Without one, the backend uses a free vision model on Cloudflare Workers AI (`WORKERS_AI_MODEL` in `backend/wrangler.toml`). It costs nothing but is less accurate. Setting `ANTHROPIC_API_KEY` switches to Claude with no code change.
2. Optional: get a free Pl@ntNet key at https://my.plantnet.org for better plant results.
3. Copy `backend/.dev.vars.example` to `backend/.dev.vars` and paste your keys in.
4. Run it on your computer:

```bash
cd backend
npm run dev
```

It prints a local address such as `http://localhost:8787`.

To put it online (free Cloudflare account):

```bash
cd backend
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY   # optional, switches from the free model to Claude
npx wrangler secret put PLANTNET_API_KEY   # optional
npm run deploy
```

It prints your public address, for example `https://animal-detector-api.yourname.workers.dev`.

### 3. Run the app on your phone

1. Install **Expo Go** from the App Store or Play Store.
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to your backend address. When testing against `npm run dev`, use your computer's local network IP (for example `http://192.168.1.20:8787`), not `localhost`.
3. Start the app and scan the QR code with your phone:

```bash
npx expo start
```

## Costs

- The AI model is set in `backend/wrangler.toml` (`CLAUDE_MODEL`). The default is `claude-opus-5-5`, the most accurate option. `claude-haiku-5-5` is far cheaper per photo; try it once you have test photos to compare.
- Pl@ntNet has a free tier for testing. An ad-supported app counts as commercial use, so plan for its paid plan when you launch.
- GBIF and Wikipedia are free.

## Still to do

- Ads (Google AdMob). Ads need a "development build" instead of Expo Go, so they come after the core app works.
- App icon, splash screen and store screenshots.
- Privacy policy page (required by both stores, because photos are sent to a server).
- Rate limiting on the backend so nobody can run up your API bill.
- Publishing with EAS (`npx eas-cli build` and `npx eas-cli submit`).
