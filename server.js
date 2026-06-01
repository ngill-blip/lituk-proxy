const express = require("express");
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});
app.post("/claude", async (req, res) => {
  try {
    const { system, messages, max_tokens } = req.body;
    const geminiBody = {
      system_instruction: system ? { parts: [{ text: system }] } : undefined,
      contents: messages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: typeof m.content === "string" ? m.content : m.content.map(b => b.text||"").join("") }]
      })),
      generationConfig: { maxOutputTokens: max_tokens || 2000 }
    };
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(geminiBody) }
    );
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error });
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text||"").join("") || "";
    res.json({ content: [{ type: "text", text }] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.listen(process.env.PORT || 3000, () => console.log("Proxy running"));
