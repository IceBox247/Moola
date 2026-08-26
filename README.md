# 🐮 Moola — Telegram Mining Mini App

Moola is a Telegram Web App where users **mine the MOOLA token**, collect a set
of neon-green **cow NFTs** that boost their mining yield, complete daily tasks,
invite friends, and withdraw earnings to their TON wallet.

It's a modern, polished re-imagining of the classic "tap-to-mine" airdrop mini
apps — the same mechanics, a much better UI, and a proper NFT layer on top.

<p align="center"><b>Mine · Collect · Earn · Invite · Withdraw</b></p>

---

## ✨ Features

| Tab | What it does |
| --- | --- |
| **Mine** | 8-hour mining sessions with a **live-ticking balance**, level progress, TON wallet chip, and a tap-to-claim loop. Your equipped NFT is the miner. |
| **Tasks** | 7-day **daily check-in** streak (Day 7 = 700 MOOLA), **Watch Ads** + **Verify Ads** reward tasks (reset daily), and one-time **social tasks**. |
| **NFTs** | The Moola cow collection. Each cow is a **selectable miner skin** with a rarity and a **yield boost**. Unlock by level or **mint with MOOLA**, then equip. |
| **Friends** | Referral link + rewards paid when invited friends complete their first task and when they finish all their daily ads. |
| **Profile** | Spendable balance, **withdraw-to-TON** request flow, sound-FX toggle, and full transaction history. |

The onboarding gate requires users to join the official partner + channel before
the app unlocks — exactly like the reference apps.

## 🏗️ Architecture — one Next.js app, deployed on Vercel

```
Moola/
├── public/
│   ├── brand/        # logo, favicon, onboarding hero
│   └── nft/          # the cow NFT collection art
└── src/
    ├── app/
    │   ├── page.tsx          # client shell
    │   ├── layout.tsx        # loads the Telegram SDK
    │   └── api/**/route.ts   # serverless API (mine, tasks, nft, friends, withdraw…)
    ├── components/           # App shell, nav, onboarding, shared UI
    ├── screens/              # Mine, Tasks, Nfts, Friends, Profile
    └── lib/                  # config (economy), db (Neon), auth, state, referrals
```

- **Frontend + backend in one deploy.** React (client) talks to Next.js API
  routes; there's nothing else to host.
- **Telegram auth is real.** Every request carries the signed `initData`, which
  the server verifies with your bot token (HMAC-SHA256). All mining math, task
  rewards, referral payouts, and withdrawals happen server-side so the client
  can't cheat.
- **Storage is Vercel Postgres (Neon).** Tables are created automatically on
  first request — no migration step.

**Stack:** Next.js 15 · React 19 · TypeScript · Tailwind · Framer Motion ·
`@neondatabase/serverless`.

## 🚀 Deploy on Vercel (the easy path)

1. **Push this repo to GitHub**, then "Import Project" in Vercel.
2. **Add a database:** Vercel dashboard → **Storage → Create Database → Neon**.
   Vercel injects `DATABASE_URL` / `POSTGRES_URL` into every environment
   automatically — no copy-paste.
3. **Set environment variables** (Project → Settings → Environment Variables):

   | Variable | Value |
   | --- | --- |
   | `BOT_TOKEN` | your bot token from [@BotFather](https://t.me/BotFather) |
   | `NEXT_PUBLIC_BOT_USERNAME` | your bot username, no `@` (for invite links) |
   | `ALLOW_DEV_AUTH` | `0` in production |
   | `NEXT_PUBLIC_PARTNER_URL` | partner link shown on the gate |
   | `NEXT_PUBLIC_CHANNEL_URL` | official channel link |
   | `NEXT_PUBLIC_X_URL` / `NEXT_PUBLIC_YOUTUBE_URL` | social task links |

4. **Deploy.** Then in @BotFather set your Web App URL (Bot Settings → Menu
   Button, or a Web App button) to the Vercel URL.

## 🧑‍💻 Local development

```bash
cp .env.example .env.local     # paste a Neon connection string into DATABASE_URL
npm install
npm run dev                    # http://localhost:3000
```

Open it in a normal browser and it runs in **dev mode** with a mock user
(`ALLOW_DEV_AUTH=1`) so you can click through every screen. Add `?ref=<id>` to
simulate a referral. Inside Telegram it uses the real signed user.

You can get a free Neon connection string at <https://neon.tech> for local dev.

## 🔧 Tuning the game

The **entire economy** lives in [`src/lib/config.ts`](src/lib/config.ts):
mining yield & session length, the check-in table, ad rewards, social tasks,
referral bonuses, the withdrawal minimum, and the **NFT collection** (names,
rarities, boosts, and unlock rules). Change it in one place.

Brand art lives in `public/brand/` and `public/nft/` — drop in replacements with
the same filenames to reskin.

## ⚠️ Note

MOOLA is an in-app reward point. The withdraw flow records **payout requests**
(status `pending`) for an operator/worker to process to TON — wire that to your
real payout rail. The ad tasks are placeholders; connect your ad network's SDK
in `src/screens/Tasks.tsx` where the reward is granted.
