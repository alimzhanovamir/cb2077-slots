# 013. Static deploy to GitHub Pages

- Status: Accepted
- Date: 2026-10-06

## Context

A playable link to the game is needed without paying for or maintaining a server.

## Decision

- The public demo is a static build of the client hosted on GitHub Pages, at
  `https://<owner>.github.io/cb2077-slots/`.
- It runs entirely in the browser in demo mode (ADR 012); sessions persist in
  `localStorage`.
- Every push to `main` publishes it (workflow steps: see
  [development](../development.md#deploy)).

## Considered options

- **GitHub Pages + demo mode** — free, no server to maintain. Chosen.
- **Host the Node.js server (Render, Fly.io)** — real network behaviour, but costs or cold
  starts; possible later.
- **Vercel / Netlify** — equivalent for static hosting; GitHub Pages keeps everything in GitHub.

## Consequences

- Every push to `main` updates the public demo.
- The demo does not exercise real networking (ping, real latency); E2E covers the `ws` mode.
