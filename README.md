# AI Mystery Room

An AI-generated mystery investigation game. See [SPEC.md](./SPEC.md) for the complete behavior and API contract.

## Run locally

1. Install server dependencies from `server/`, copy `.env.example` to `.env`, and set MongoDB and Gemini credentials.
2. Install client dependencies from `client/`; set `VITE_API_URL=http://localhost:5000/api` in `client/.env.local`.
3. Start the API with `npm run dev` in `server/` and the UI with `npm run dev` in `client/`.

See [server/README.md](./server/README.md) for deployment setup. The game cannot generate cases until server credentials are configured.

## Deploy

- Backend: connect this GitHub repository to Render using the Blueprint in `render.yaml`. Set `MONGODB_URI`, `GEMINI_API_KEY`, and `CLIENT_URL` in the Render service environment. Set `CLIENT_URL` to the deployed Vercel origin.
- Frontend: import the repository into Vercel, set the project root to `client`, and set `VITE_API_URL` to the Render API origin followed by `/api` (for example, `https://your-api.onrender.com/api`).
- After the first backend deploy, copy its public URL into Vercel's `VITE_API_URL`, deploy the frontend, then set the resulting frontend origin as Render's `CLIENT_URL` and redeploy the backend.
- Never enter server secrets into Vercel or commit `.env` files. Only the client API base URL belongs in the frontend environment.
