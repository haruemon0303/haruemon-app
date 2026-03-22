/*  www/script.js  */

/* ──────────────────────────────────────────
   1. グローバル状態
      ・前回ブラウザを閉じた時点の性格／好感度を localStorage から復元
      ・初回は「なかよし／70%」スタートにしておく
────────────────────────────────────────── */
let currentType      = localStorage.getItem("haru_type")      || "friendly";
let currentAffection = Number(localStorage.getItem("haru_aff")) || 70;

/* ページが描画されたら即 UI に反映 */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("personalityDisplay").textContent =
    `現在のはるえもんの性格：${typeLabel(currentType)}`;
  document.getElementById("affectionBar").value           = currentAffection;
  document.getElementById("affectionDisplay").textContent = `${currentAffection}%`;
});

/* 性格コード → 日本語ラベル */
function typeLabel(t) {
  return { tsundere: "ツンデレ", friendly: "なかよし", deredere: "デレデレ" }[t] || "ツンデレ";
}

/* チャットログに1行追加する関数
   innerHTML を使わず DOM要素を作ることで XSS を防ぐ */
function appendChat(speaker, text, isError = false) {
  const chatLog = document.getElementById("chat-area");
  const p       = document.createElement("p");
  if (isError) p.style.color = "red";

  const strong = document.createElement("strong");
  strong.textContent = `${speaker}：`;  // textContent はHTMLとして解釈されない

  p.appendChild(strong);
  p.appendChild(document.createTextNode(` ${text}`));  // テキストノードも同様
  chatLog.appendChild(p);
  chatLog.scrollTop = chatLog.scrollHeight;
}

/* ──────────────────────────────────────────
   2. 発声関数（Web Speech API）
────────────────────────────────────────── */
function speak(text) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";

  /* キャラごとに声色を少し変える */
  switch (currentType) {
    case "tsundere": u.pitch = 1.4; u.rate = 1.0;  break;
    case "friendly": u.pitch = 1.1; u.rate = 1.0;  break;
    case "deredere": u.pitch = 1.6; u.rate = 0.95; break;
    default:         u.pitch = 1.2; u.rate = 1.0;
  }

  /* 使えそうな日本語ボイスを選択 */
  const voices = speechSynthesis.getVoices();
  const preferred = ["Kyoko", "Google 日本語", "Microsoft Haruka"];
  u.voice =
    voices.find(v => v.lang === "ja-JP" && preferred.some(n => v.name.includes(n))) ||
    voices.find(v => v.lang === "ja-JP");

  /* 口パク画像制御 */
  const img = document.getElementById("characterImage");
  speechSynthesis.cancel();          // キューをクリア
  img.src = "character_talk.png";    // 口を開いた画像
  u.onend = () => (img.src = "character.png");
  speechSynthesis.speak(u);
}

/* ──────────────────────────────────────────
   3. 会話送信
────────────────────────────────────────── */
async function sendMessage() {
  const input        = document.getElementById("user-input");
  const chatLog      = document.getElementById("chat-area");
  const userMessage  = input.value.trim();
  if (!userMessage) return;

  /* 自分の発言を表示 */
  appendChat("あなた", userMessage);
  input.value = "";

  try {
    const r = await fetch("/chat", {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({
        message      : userMessage,
        characterType: currentType,
        affection    : currentAffection
      })
    });
    const j = await r.json();

    /* 状態を更新し、localStorage にも保存 */
    currentType      = j.characterType;
    currentAffection = j.affection;
    localStorage.setItem("haru_type", currentType);
    localStorage.setItem("haru_aff" , currentAffection);

    /* UI 更新 */
    document.getElementById("personalityDisplay").textContent =
      `現在のはるえもんの性格：${typeLabel(currentType)}`;
    document.getElementById("affectionBar").value           = currentAffection;
    document.getElementById("affectionDisplay").textContent = `${currentAffection}%`;

    /* 返答を表示＆発声 */
    appendChat("はるえもん", j.reply);
    speak(j.reply);

  } catch (e) {
    appendChat("エラー", "通信に失敗しました。もう一度お試しください。", true);
  }
}

/* ──────────────────────────────────────────
   4. Web 検索
────────────────────────────────────────── */
async function performSearch(queryText) {
  const input        = document.getElementById("search-input");
  const chatLog      = document.getElementById("chat-area");
  const query        = queryText || input.value.trim();
  if (!query) return;

  appendChat("あなた（検索）", query);
  input.value = "";

  try {
    const r  = await fetch("/search", {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ query })
    });
    const j  = await r.json();

    appendChat("はるえもん（検索結果）", j.result);
    speak(j.result);

  } catch (e) {
    appendChat("エラー", "検索に失敗しました。もう一度お試しください。", true);
  }
}

/* ──────────────────────────────────────────
   5. 音声入力
────────────────────────────────────────── */
function startVoiceInput() {
  const Recog = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recog = new Recog();
  recog.lang = "ja-JP";

  recog.onresult = (e) => {
    const text = e.results[0][0].transcript;
    const mode = document.querySelector('input[name="mode"]:checked').value;
    if (mode === "chat") {
      document.getElementById("user-input").value = text;
      sendMessage();
    } else {
      document.getElementById("search-input").value = text;
      performSearch(text);
    }
  };
  recog.onerror = (e) => console.error("音声認識エラー:", e.error);
  recog.start();
}

/* ──────────────────────────────────────────
   6. Safari 対策：初回クリックで音声合成許可
────────────────────────────────────────── */
window.addEventListener("click", () => {
  const t = new SpeechSynthesisUtterance("にゃー。ぼくはるえもん。");
  t.lang = "ja-JP";
  speechSynthesis.speak(t);
}, { once: true });
