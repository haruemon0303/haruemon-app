// server.js ― Fly.io / ローカル共通

const express = require("express");
const fetch   = require("node-fetch");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

/* ─ 環境変数から API キー ─ */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SERPAPI_KEY    = process.env.SERPAPI_KEY;

app.use(express.json());
app.use(express.static(path.join(__dirname, "www")));

/* ─ 性格定義 ─ */
const personalityPrompt = {
  tsundere : "あなたはツンデレな AI キャラです。素直になれないけど内心は大好き。",
  friendly : "あなたは親しみやすくフレンドリーな AI キャラです。",
  deredere : "あなたは甘くデレデレな AI キャラです。"
};

/* ─ 会話エンドポイント ─ */
app.post("/chat", async (req, res) => {
  const { message, characterType = "tsundere", affection = 50 } = req.body;
  if (!message) return res.status(400).json({ error: "空メッセージ" });

  try {
    const oaRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization : `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model   : "gpt-4o-mini",
        messages: [
          { role: "system", content: personalityPrompt[characterType] },
          { role: "user",   content: message }
        ]
      })
    });
    const data  = await oaRes.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "……";

    /* 簡易：好感度＋10 (ありがとう系) */
    let newAff = affection;
    if (/ありがと|サンキュー|thanks/i.test(message)) newAff = Math.min(affection + 10, 100);

    /* 性格遷移 */
    let newType   = "tsundere";
    let label     = "ツンデレ";
    if (newAff >= 80)      { newType = "deredere"; label = "デレデレ"; }
    else if (newAff >= 50) { newType = "friendly"; label = "なかよし"; }

    res.json({
      reply,
      affection      : newAff,
      characterType  : newType,
      personalityLabel: label
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "OpenAI エラー" });
  }
});

/* ─ 検索エンドポイント ─ */
app.post("/search", async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "検索語なし" });

  try {
    const sRes = await fetch(
      `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&hl=ja&gl=jp&api_key=${SERPAPI_KEY}`
    );
    const sJson = await sRes.json();
    const snippets = (sJson.organic_results || [])
      .map(r => r.snippet).filter(Boolean).slice(0, 3).join("\n");

    const sumRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization : `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model   : "gpt-4o-mini",
        messages: [
          { role:"system", content:"以下を子どもにも分かるよう要約してください" },
          { role:"user",   content: snippets || "結果なし" }
        ]
      })
    });
    const sum = await sumRes.json();
    res.json({ result: sum.choices?.[0]?.message?.content?.trim() || "要約失敗" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:"検索エラー" });
  }
});
// ─ プライバシーポリシーページ ─
app.get("/privacy", (req, res) => {
  res.sendFile(path.join(__dirname, "www/privacy.html"));
});

app.listen(PORT, "0.0.0.0", () =>
  console.log(`🌸 Haruemon server on http://0.0.0.0:${PORT}`)
);
