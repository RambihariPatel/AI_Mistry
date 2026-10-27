# AI Mystery Room — Product and Technical Specification

## 1. Overview

AI Mystery Room is a single-player, AI-powered investigation game. A player supplies a premise and difficulty; the server uses Gemini to create a solvable case with suspects, discoverable clues, and progressive hints. The player investigates, requests optional hints, accuses one suspect, and receives a verdict and score.

### Problem statement

People enjoy interactive mysteries but often lack a quick way to play fresh, tailored cases. This project delivers short, replayable cases with clear investigation actions and an explainable final reveal.

### Target users and experience

Casual players, students, and mystery-writing enthusiasts using desktop or mobile browsers. The experience should feel like entering a case file: focused, readable, atmospheric, and usable without instructions. The player should understand what is available, what has been discovered, and what actions remain.

## 2. Requirements

### Core features

- Enter a premise (10–500 characters) and choose Easy, Medium, or Hard.
- Generate structured cases with the prescribed counts of suspects, clues, and hints.
- Show the title, story, suspect profiles, and clue labels without revealing hidden clue contents, culprit, or solution.
- Let players discover clues, request sequential hints, and accuse one suspect.
- Calculate score on the server and reveal verdict, culprit, and explanation only after accusation.
- Persist cases in MongoDB and retrieve active/completed cases by ID.
- Responsive accessible UI, loading/error/empty states, and start-another-case flow.

### Optional enhancements

- Persist progress across browser refreshes using the case ID in the URL.
- Ambient visual styling and clue/hint progress indicators.

### Technology stack

- Client: React, Vite, React Router, Axios, Tailwind CSS.
- Server: Node.js, Express, Mongoose, Zod, `@google/genai`.
- Data: MongoDB / MongoDB Atlas.
- Generation: Gemini API through the server only.
- Hosting target: Vercel frontend and a Node-capable host for the backend.

### Limitations

- Requires valid Gemini and MongoDB credentials for generation and persistence.
- Cases are not authenticated or private; possession of a case ID grants access.
- No multiplayer, user accounts, moderation dashboard, or guaranteed deterministic output from the model.
- Generated content is validated structurally and for basic solution support, but semantic quality still depends on the model.

### Deliverables

`SPEC.md`, separate `client/` and `server/` applications, environment examples, and deployment instructions.

## 3. User flow

1. Open the home page and read the short introduction.
2. Start a case, enter a premise, and choose a difficulty.
3. The client posts the request to the server; Gemini generates JSON; the server validates it and saves the case.
4. Enter the investigation room. Read the story and suspect profiles.
5. Discover clues to reveal their content; progress is stored server-side.
6. Request hints in order; each use is recorded server-side.
7. Choose a suspect and submit an accusation.
8. The server computes verdict and score and returns the completed result with the solution.
9. View the results and start a new case.

## 4. Pages and UI behavior

### Home (`/`)

Purpose: explain the game and invite play. Includes brand, concise introduction, primary Start investigating action, and feature summary.

### Create Mystery (`/create`)

Purpose: collect premise and difficulty. Includes labeled textarea, character guidance, three difficulty choices with counts, validation feedback, submit state, and return navigation.

### Investigation Room (`/case/:id`)

Purpose: investigate without exposing the answer. Includes case title/story, difficulty and progress, suspect cards, clue cards with discover actions, hint area and request action, and accusation section. Loading, missing case, API failure, already-completed, and action-in-progress states are handled.

### Accusation

Presented within the investigation room as a clearly separated step. Player selects one suspect and confirms submission. Duplicate submissions are rejected; completed cases navigate to results.

### Results (`/case/:id/result`)

Purpose: disclose outcome after accusation. Includes verdict, score breakdown, culprit, solution explanation, and new-case action. Only server result endpoints may provide solution data.

### Responsive and accessible behavior

Mobile-first single-column layouts; wider screens use two-column investigation panels. Semantic headings, visible focus, keyboard-operable controls, labeled inputs, sufficient contrast, and status announcements for loading/errors.

## 5. API contract

Base path: `/api`. JSON request and response bodies. IDs are MongoDB ObjectIds. Errors use `{ "error": { "code": string, "message": string } }` with an appropriate 4xx/5xx status. CORS allows the configured client origin.

### `POST /api/cases`

Request: `{ "premise": string, "difficulty": "easy" | "medium" | "hard" }`.

Success 201 returns a safe public case: `{ "case": { "id", "title", "story", "difficulty", "suspects": [{"id","name","role","description"}], "clues": [{"id","label","discovered","content?"}], "hintsRemaining", "progress", "status" } }`. Clue contents are omitted until discovered. No solution fields are returned.

### `GET /api/cases/:id`

Returns the same safe public case view and player progress. Never returns culprit or solution.

### `POST /api/cases/:id/clues/:clueId/discover`

Empty request. Marks the clue discovered once. Returns the safe case view with discovered clue contents. Re-discovery is idempotent and does not award duplicate points.

### `POST /api/cases/:id/hints`

Empty request. Reveals the next hint and records its use. Returns `{ "hint": {"index","text"}, "hintsRemaining", "scorePreview" }`. Rejects completed cases or exhausted hints.

### `POST /api/cases/:id/accuse`

Request: `{ "suspectId": string }`. Rejects unknown suspects and completed cases. Returns `{ "result": {"correct","score","scoreBreakdown","culprit","explanation"} }`; this is the first endpoint that reveals the solution.

### `GET /api/cases/:id/result`

Returns the result only after the case is completed; otherwise returns 409.

### Validation and errors

Zod validates request bodies, difficulty, and ObjectId format. Unknown resources return 404, invalid requests 400, completed/invalid state transitions 409, AI/configuration failures 503 or 500 with a safe message. Do not return stack traces or secrets. AI output is parsed and validated before persistence; malformed output returns a retryable generation error.

## 6. Data model and privacy boundary

`Case` stores premise, title, story, difficulty, suspects, clues, hints, `culpritSuspectId`, `solutionExplanation`, status, discovered clue IDs, used hint count, accusation suspect ID, score, and timestamps. Embedded records use generated stable subdocument IDs. Solution fields are private server state: public serializers use explicit allowlists and never serialize the raw Mongoose document. Only accusation/result handlers may read solution fields into a response, and only after the accusation has been accepted.

## 7. AI output and scoring

Counts: Easy = 3 suspects, 5 clues, 2 hints; Medium = 4 suspects, 7 clues, 3 hints; Hard = 5 suspects, 9 clues, 3 hints.

Gemini must return JSON matching:

```json
{
  "title": "string",
  "story": "string",
  "suspects": [{"name":"string","role":"string","description":"string"}],
  "clues": [{"label":"string","content":"string"}],
  "hints": ["string"],
  "culpritIndex": 0,
  "solutionExplanation": "string"
}
```

The solution must be logically consistent, supported by clues, and identify exactly one listed suspect. Server validation checks field lengths, exact counts, unique suspect names, valid culprit index, nonempty text, and explanation presence before saving. Gemini credentials remain server-side.

Scoring (server only): correct accusation base = Easy 100, Medium 150, Hard 200; +5 per uniquely discovered clue; −10 per hint used; clamp minimum to 0. Incorrect accusation = 0. Result includes base, clue bonus, hint penalty, and total. A case can be accused once.

## 8. Acceptance criteria

- All three difficulty levels generate the exact required counts.
- Players can discover clues, request available hints, and submit one accusation.
- Culprit and solution explanation never appear in generation, active-case, clue, or hint responses.
- Server validates AI output and calculates score, including duplicate clue protection and minimum zero.
- Results show the correct culprit, verdict, explanation, and score breakdown after accusation.
- Invalid AI output and API failures produce safe, understandable errors.
- The responsive client completes the full flow against a deployed API with production environment variables configured.

## 9. Environment and deployment

Server variables: `PORT`, `MONGODB_URI`, `GEMINI_API_KEY`, `GEMINI_MODEL` (optional), `CLIENT_URL`. Client variable: `VITE_API_URL` (backend origin plus `/api`). Never put server secrets in client variables or commit `.env` files. Deploy the server to a Node hosting provider, provision MongoDB Atlas, set server environment values, deploy `client/` to Vercel, set `VITE_API_URL`, then run an end-to-end production case before submitting.
