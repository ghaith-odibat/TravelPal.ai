const messagesEl = document.getElementById("messages");
const welcomeEl = document.getElementById("welcome");
const form = document.getElementById("composer");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const newChatBtn = document.getElementById("new-chat");

const API_BASE = (window.TRAVELPAL_API_BASE || "").replace(/\/+$/, "");
const IS_STATIC_HOST = location.hostname.endsWith("github.io");

/** Conversation history sent to the server: [{ role, content }] */
let history = [];
let controller = null;

function addBubble(role, text = "") {
  welcomeEl.hidden = true;
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = text;
  messagesEl.appendChild(el);
  scrollToBottom();
  return el;
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setBusy(busy) {
  sendBtn.disabled = busy;
  input.disabled = busy;
  if (!busy) input.focus();
}

async function sendMessage(text) {
  history.push({ role: "user", content: text });
  addBubble("user", text);

  const bubble = addBubble("assistant");
  bubble.classList.add("pending");
  setBusy(true);

  let reply = "";
  let failed = false;
  controller = new AbortController();

  try {
    if (!API_BASE && IS_STATIC_HOST) {
      throw new Error("This page has no chat backend set up yet. Set the TRAVELPAL_API_BASE repository variable and redeploy.");
    }
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Request failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        const event = JSON.parse(line);
        if (event.type === "text") {
          reply += event.text;
          bubble.textContent = reply;
          scrollToBottom();
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      }
    }
  } catch (err) {
    if (err.name === "AbortError") return;
    failed = true;
    bubble.classList.add("error");
    bubble.textContent = reply ? `${reply}\n\n⚠️ ${err.message}` : `⚠️ ${err.message}`;
  } finally {
    bubble.classList.remove("pending");
    controller = null;
    setBusy(false);
  }

  if (!failed && reply) {
    history.push({ role: "assistant", content: reply });
  } else {
    // Drop the unanswered user turn so the next request stays well-formed.
    history.pop();
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || controller) return;
  input.value = "";
  autoResize();
  sendMessage(text);
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    form.requestSubmit();
  }
});

function autoResize() {
  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
}
input.addEventListener("input", autoResize);

document.querySelectorAll(".suggestions button").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (controller) return;
    sendMessage(btn.textContent);
  });
});

newChatBtn.addEventListener("click", () => {
  controller?.abort();
  history = [];
  messagesEl.querySelectorAll(".msg").forEach((el) => el.remove());
  welcomeEl.hidden = false;
  setBusy(false);
});

input.focus();
