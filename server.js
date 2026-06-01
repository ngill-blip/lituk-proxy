const express = require("express");
const app = express();
app.use(express.json());

// --- CORS ---
const ALLOWED_ORIGIN = "https://ngill-blip.github.io"; // or "*" to allow any
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// Translate the frontend's Anthropic-shaped body -> Groq (OpenAI) body.
function toGroqBody(body) {
  const messages = [];
  if (body.system) messages.push({ role: "system", content: String(body.system) });
  for (const m of body.messages || []) {
    // Anthropic content can be a string or an array of blocks; flatten to text.
    let content = m.content;
    if (Array.isArray(content)) {
      content = content.map((b) => (typeof b === "string" ? b : b.text || "")).join("");
    }
    messages.push({ role: m.role, content: String(content ?? "") });
  }
  // response_format json_object requires the word "json" somewhere in the prompt.
  const hasJson = messages.some((m) => /json/i.test(m.content));
  if (!hasJson && messages.length) {
    messages[0].content += "\nRespond with valid JSON only.";
  }
  return {
    model: GROQ_MODEL,
    max_tokens: body.max_tokens || 1024,
    messages,
    response_format: { type: "json_object" },
  };
}

async function callGroq(groqBody) {
  const r = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(groqBody),
  });
  const data = await r.json();
  return { status: r.status, data };
}

app.post("/claude", async (req, res) => {
  try {
    const groqBody = toGroqBody(req.body);

    let { status, data } = await callGroq(groqBody);
    if (status !== 200) {
      return res.status(status).json({ error: data.error || data });
    }

    let text = data?.choices?.[0]?.message?.content ?? "";

    // Guard: ensure the text is valid JSON. Strip code fences, then retry once.
    const clean = (s) => s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    text = clean(text);
    try {
      JSON.parse(text);
    } catch {
      const retry = await callGroq({ ...groqBody, temperature: 0 });
      if (retry.status === 200) {
        const t2 = clean(retry.data?.choices?.[0]?.message?.content ?? "");
        try {
          JSON.parse(t2);
          text = t2;
        } catch {
          /* fall through with best-effort text */
        }
      }
    }

    // Return in the Anthropic shape the frontend already expects.
    res.json({ content: [{ type: "text", text }] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("Proxy running (Groq)"));
