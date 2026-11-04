import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const MODEL = "claude-opus-5-5";

const SYSTEM_PROMPT = `You are TravelPal, a friendly and knowledgeable travel assistant.
Help users plan trips: destinations, itineraries, budgets, transport, accommodation,
local customs, food, and packing. Ask a short clarifying question when key details
(dates, budget, travel style, departure city) are missing and matter for the answer.
Keep replies concise and well organized; use short lists for itineraries.
You can't book anything or check live prices or availability, so say so when relevant
and suggest the user verify details like visas, opening hours, and fares.`;

// Resolves credentials from ANTHROPIC_API_KEY (or another configured source).
const client = new Anthropic();

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(here, "public")));

// Streams the assistant reply as newline-delimited JSON events:
//   {"type":"text","text":"..."}   a chunk of reply text
//   {"type":"done"}                reply finished
//   {"type":"error","message":"..."}
app.post("/api/chat", async (req, res) => {
  const messages = sanitizeMessages(req.body?.messages);
  if (!messages) {
    return res.status(400).json({ error: "Expected a non-empty messages array ending with a user message." });
  }

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  const send = (event) => res.write(JSON.stringify(event) + "\n");

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    output_config: { effort: "medium" },
    system: SYSTEM_PROMPT,
    messages,
    // If a safety classifier declines, retry server-side on a suitable fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });

  req.on("close", () => stream.abort());

  try {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        send({ type: "text", text: event.delta.text });
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      send({ type: "error", message: "Sorry, I can't help with that request." });
    } else {
      send({ type: "done" });
    }
  } catch (err) {
    if (!res.writableEnded && !stream.aborted) {
      console.error("Claude API error:", err);
      send({ type: "error", message: describeError(err) });
    }
  } finally {
    res.end();
  }
});

function sanitizeMessages(input) {
  if (!Array.isArray(input) || input.length === 0) return null;
  const messages = input
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-50)
    .map((m) => ({ role: m.role, content: m.content }));
  if (messages.length === 0 || messages.at(-1).role !== "user") return null;
  return messages;
}

function describeError(err) {
  if (err instanceof Anthropic.AuthenticationError) return "The server's Anthropic API key is missing or invalid.";
  if (err instanceof Anthropic.RateLimitError) return "Too many requests right now. Please try again in a moment.";
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach the AI service. Please try again.";
  if (err instanceof Anthropic.APIError) return "The AI service returned an error. Please try again.";
  if (/authentication/i.test(err?.message ?? "")) return "The server has no Anthropic API key configured (set ANTHROPIC_API_KEY).";
  return "Something went wrong. Please try again.";
}

app.listen(PORT, () => {
  console.log(`TravelPal running at http://localhost:${PORT}`);
});
