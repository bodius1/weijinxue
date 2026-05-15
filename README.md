# 为进学 Weijinxue

### Free, open-source Mandarin Chinese learning app

> 为进学 (wéi jìn xué) — "for advancing in learning"

## 🌐 Try it live

**[weijinxue.com](https://weijinxue.com)**

## ✨ Features

- 📖 **Learn** — Pinyin search with stroke order and fill-in-the-blank practice
- 🃏 **Flashcards** — HSK 1-6 spaced repetition with 1-5 ratings
- 🧠 **Quiz** — Multiple choice with smart SR algorithm per HSK level
- ⌨️ **Type** — Microsoft-style pinyin IME typing game (Characters + Sentences mode)
- 🤖 **Yǔbàn AI** — AI Mandarin conversation partner powered by Groq/Llama

## 🛠️ Tech Stack

- React + Vite + Tailwind CSS
- Firebase Auth + Firestore
- CC-CEDICT dictionary
- hanzi-writer stroke order animation
- Groq / Llama 3.3 70B AI

## 🚀 Run Locally

```bash
cd mandarin-app
npm install
npm run dev
```

## 🔧 Environment Variables

Create a `.env` file in `mandarin-app/` with:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

## ☕ Support

If you find this useful, consider supporting: **[buymeacoffee.com/joaquindh](https://buymeacoffee.com/joaquindh)**

## 📄 License

GNU General Public License v3.0 — see [LICENSE](LICENSE)

## 🙏 Credits

Typing engine inspired by [Qwerty Learner](https://github.com/RealKai42/qwerty-learner)

HSK vocabulary from [MandarinBean](https://mandarinbean.com)

---

Built with ☕ by [Joaquin](https://github.com/bodius1)
