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
    const groqMessages = [];
    if (system) groqMessages.push({ role: "system", content: system });
    messages.forEach(m => groqMessages.push({
      role: m.role,
      content: typeof m.content === "string" ? m.content : m.content.map(b => b.text || "").join("")
    }));
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({ model: "llama-3.1-8b-instant", messages: groqMessages, max_tokens: max_tokens || 2000 })
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error });
    const text = data.choices?.[0]?.message?.content || "";
    res.json({ content: [{ type: "text", text }] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.listen(process.env.PORT || 3000, () => console.log("Proxy running"));
