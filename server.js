// server.js ― Fly.io / ローカル共通

const express   = require("express");
const fetch     = require("node-fetch");
const path      = require("path");
const rateLimit = require("express-rate-limit");
const helmet    = require("helmet");

const app  = express();
const PORT = process.env.PORT || 3000;

/* ─ 環境変数から API キー ─ */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SERPAPI_KEY    = process.env.SERPAPI_KEY;

/* ─ 入力長の上限 ─ */
const MAX_MESSAGE_LENGTH = 500;  // 会話メッセージの最大文字数
const MAX_QUERY_LENGTH   = 200;  // 検索クエリの最大文字数

/* ─ レート制限：/chat と /search に適用
   1つのIPから1分間に20回まで（超えたら429を返す） ─ */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1分間
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "リクエストが多すぎます。少し待ってからもう一度お試しください。" },
});

/* ─ セキュリティヘッダー（helmet）
   XSS・クリックジャッキング・MIME混乱などをまとめて防ぐ ─ */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],           // 外部スクリプト読み込みを禁止
      styleSrc:   ["'self'", "'unsafe-inline'"],  // style.css のインラインを許可
      imgSrc:     ["'self'", "data:"],  // キャラ画像など同一オリジンのみ
      mediaSrc:   ["'self'"],           // 音声合成は Web Speech API（ブラウザ内）なので問題なし
      connectSrc: ["'self'"],           // fetch の送信先を自サーバーのみに制限
    },
  },
}));

app.use(express.json({ limit: "10kb" }));  // ボディサイズ上限を10KBに制限
app.use(express.static(path.join(__dirname, "www")));
app.use("/chat",   apiLimiter);
app.use("/search", apiLimiter);

/* ─ 性格定義 ─ */
const personalityPrompt = {
  tsundere : "あなたはツンデレな AI キャラです。素直になれないけど内心は大好き。",
  friendly : "あなたは親しみやすくフレンドリーな AI キャラです。",
  deredere : "あなたは甘くデレデレな AI キャラです。"
};

/* ─ 会話エンドポイント ─ */
app.post("/chat", async (req, res) => {
  const { message, characterType = "tsundere", affection = 50 } = req.body;
  if (!message || typeof message !== "string") return res.status(400).json({ error: "空メッセージ" });
  if (message.length > MAX_MESSAGE_LENGTH) return res.status(400).json({ error: `メッセージは${MAX_MESSAGE_LENGTH}文字以内にしてください` });

  try {
    const systemContent = `${personalityPrompt[characterType] || personalityPrompt.tsundere}
ユーザーのメッセージに返答し、必ず以下のJSON形式のみで返してください（他のテキストは不要）：
{"reply": "返答テキスト", "affectionDelta": 数値}
affectionDeltaは-10〜+10の整数で、メッセージの感情に応じて決めてください：
- 感謝・褒め言葉・親切な言葉：+5〜+10
- 普通の会話・挨拶：-1〜+3
- 無礼・悪口・否定的な言葉：-5〜-10`;

    const oaRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization : `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model              : "gpt-4o-mini",
        response_format    : { type: "json_object" },
        messages: [
          { role: "system", content: systemContent },
          { role: "user",   content: message }
        ]
      })
    });
    const data = await oaRes.json();
    const raw  = data.choices?.[0]?.message?.content?.trim() || "{}";

    let reply, affectionDelta;
    try {
      const parsed   = JSON.parse(raw);
      reply          = parsed.reply        || "……";
      affectionDelta = Number(parsed.affectionDelta) || 0;
    } catch {
      reply          = raw;
      affectionDelta = 0;
    }

    /* 好感度を更新（0〜100にクランプ） */
    let newAff = Math.max(0, Math.min(100, affection + affectionDelta));

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
  if (!query || typeof query !== "string") return res.status(400).json({ error: "検索語なし" });
  if (query.length > MAX_QUERY_LENGTH) return res.status(400).json({ error: `検索語は${MAX_QUERY_LENGTH}文字以内にしてください` });

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
