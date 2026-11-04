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

## Deploy for free (Render)

The repo includes a `render.yaml` Blueprint for Render's free web service.

1. Sign in at https://render.com with GitHub.
2. **New → Blueprint**, pick this repository and the branch you want to deploy.
3. When prompted, paste your `ANTHROPIC_API_KEY`, then click **Apply**.
4. Your site goes live at `https://travelpal-ai.onrender.com` (or a similar URL).

Notes:
- Free services sleep after ~15 minutes without traffic; the first visit afterwards
  takes 30–60 seconds to wake up.
- Hosting is free, but Claude API usage is billed to your Anthropic account. Each
  visitor is limited to `RATE_LIMIT_MAX` messages per `RATE_LIMIT_WINDOW_MINUTES`
  (default 20 per hour), and messages are capped at 4,000 characters. Adjust the
  env vars in Render, and consider setting a spend limit in the Anthropic Console.
