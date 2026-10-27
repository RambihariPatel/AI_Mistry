# Server

Copy `.env.example` to `.env` and configure credentials. `CLIENT_URL` must match the deployed frontend origin. Deploy this directory as a Node service with `npm install` and `npm start`; provide a health check at `/api/health`.
