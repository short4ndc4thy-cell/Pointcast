# PointCast — Prediction Markets with Points

A Polymarket-style prediction market platform using points instead of real money. Built with React + Vite + Supabase.

## Stack

- **Frontend:** React 18 + Vite
- **Backend/DB/Auth:** Supabase (Postgres + Auth + Realtime)
- **Styling:** Tailwind CSS
- **Deployment:** Vercel

## Quick Start

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd pointcast
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and paste the entire contents of `supabase/schema.sql`, then run it
3. In **Settings → API**, copy your Project URL and anon/public key

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 5. Create Your First Admin

1. Sign up through the app
2. In Supabase **Table Editor → profiles**, set `is_admin = true` on your row
3. Refresh the app — you'll now see the Admin link in the nav

### 6. Deploy to Vercel

1. Push to GitHub
2. Connect the repo in [Vercel](https://vercel.com)
3. Add environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
4. Deploy

## Features

- **Markets:** Create, close, resolve, void prediction markets
- **Parimutuel Betting:** Proportional pool odds with 5% house rake
- **Real-time Odds:** Supabase Realtime updates odds as bets come in
- **Leaderboard:** Points ranking + calibration scores
- **Calibration Score:** Measures how well a user's confidence matches outcomes
- **Full Admin Dashboard:** Manage markets, bets, users, view platform stats
- **User Profiles:** Bet history, transaction log, stats
- **Dark Theme:** Trading terminal aesthetic

## Odds System

Uses a parimutuel (proportional pool) model:

- **Displayed odds** for option X = `total_pool / points_on_X`
- **Payout on win:** `(your_stake / winning_pool) × total_pool × 0.95`
- **On void:** All bets refunded 1:1
- 5% rake prevents point inflation

## Calibration Score

Measures prediction accuracy across odds buckets (1.0–1.5x, 1.5–2x, 2–3x, 3x+):

```
Score = 100 - avg(|implied_probability - actual_win_rate| × 100)
```

Requires ≥10 resolved bets to display.
