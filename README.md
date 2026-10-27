# AI Mystery Room

An AI-generated mystery investigation game. See [SPEC.md](./SPEC.md) for the complete behavior and API contract.

## Run locally

1. Install server dependencies from `server/`, copy `.env.example` to `.env`, and set MongoDB and Gemini credentials.
2. Install client dependencies from `client/`; set `VITE_API_URL=http://localhost:5000/api` in `client/.env.local`.
3. Start the API with `npm run dev` in `server/` and the UI with `npm run dev` in `client/`.

See [server/README.md](./server/README.md) for deployment setup. The game cannot generate cases until server credentials are configured.
