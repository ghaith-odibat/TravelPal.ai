# TravelPal.ai

A simple AI travel-assistant chat page powered by Claude.

## Run it

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm start
```

Then open http://localhost:3000.

## How it works

- `server.js` – Express server. Serves `public/` and exposes `POST /api/chat`, which
  streams Claude's reply back as newline-delimited JSON (`{"type":"text"}` chunks,
  then `{"type":"done"}` or `{"type":"error"}`).
- `public/` – plain HTML/CSS/JS chat UI. The browser keeps the conversation history
  and sends it with each request (no database yet).

The model is `claude-opus-5-5` with server-side refusal fallbacks enabled; change
`MODEL` or the system prompt at the top of `server.js`.
