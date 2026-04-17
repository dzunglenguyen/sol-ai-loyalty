# SOL-AI Loyalty

An AI-powered loyalty and personalized offers engine built natively into the Shinhan Bank SOL ecosystem. Prototype for **Global Shinhan InnoBoost 2026** (Financial Services Track).

Merchants self-serve campaign creation via natural language. Users receive AI-ranked, location-aware offers and pay with a single Dynamic QR — no separate app required.

---

## Architecture

```
┌─────────────────┐   ┌──────────────┐   ┌──────────────┐
│  Merchant Portal│   │   SOL App    │   │  POS Scanner │
│  (Next.js 16)   │   │  (Next.js 14)│   │  (in portal) │
│  :3000          │   │  :3001       │   │              │
└────────┬────────┘   └──────┬───────┘   └──────┬───────┘
         │                   │                   │
         └───────────┬───────┴───────────────────┘
                     ▼
              Backend API (Express :4000)
              ┌──────┴──────┐
              ▼             ▼
         Supabase      Alibaba Cloud AI
        (PolarDB)     (Qwen · PAI-EAS ·
                       DashVector ·
                       Function Compute)
```

| Module | Description | Port |
|---|---|---|
| **merchant** | Merchant campaign builder, AI copilot, revenue dashboard, POS scanner | 3000 |
| **sol-app** | Simulated SOL PWA — AI-ranked offer feed, geo-trigger, Dynamic QR checkout | 3001 |
| **backend** | Express API — campaigns, offers, QR signing, geo, AI scoring | 4000 |
| **agent** | LangGraph + CopilotKit AI agent for campaign generation | 8123 |

---

## Project Structure

```
├── merchant/                         # Merchant portal monorepo (pnpm + Turborepo)
│   ├── apps/
│   │   ├── web/                      # Next.js 16 — campaign builder, dashboard, POS
│   │   │   ├── src/app/(app)/        # Main app pages (campaigns, analytics, KB, POS)
│   │   │   ├── src/app/(auth)/       # Clerk login/register
│   │   │   ├── src/app/api/          # CopilotKit runtime, document processing, QR
│   │   │   ├── src/components/       # Campaign form, dashboard, charts, onboarding
│   │   │   ├── src/hooks/            # Campaign copilot, Supabase client
│   │   │   ├── src/lib/              # Brand tokens, Supabase repos, QR, estimation
│   │   │   └── src/utils/            # Estimation engine
│   │   └── agent/                    # LangGraph AI agent (CopilotKit SDK)
│   │       └── src/agent.ts          # Agent graph: Qwen/Gemini, KB tools, campaign gen
│   ├── supabase/migrations/          # Database migrations
│   └── patches/                      # CopilotKit patches
│
├── sol-ai-loyalty-poc/               # User-facing SOL app + backend
│   ├── apps/sol-app/                 # Next.js 14 PWA
│   │   ├── app/                      # Pages: home, vouchers, offers/[id], QR, transfer
│   │   ├── components/               # TopNav, BottomNav, OfferCard, MerchantMap
│   │   ├── hooks/                    # useExplainOffer, useProximityNotifier
│   │   └── public/                   # PWA manifest, service worker, icons
│   └── backend/                      # Express API server
│       ├── routes/                   # offers, explainOffer, nearby-offers, qr, orders
│       ├── services/                 # Qwen, PAI-EAS, DashVector, QR, Supabase clients
│       └── db/                       # Seed data (9 merchants), schema reference
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Merchant Frontend | Next.js 16, React 19, Tailwind CSS, CopilotKit |
| SOL App Frontend | Next.js 14, React 18, Tailwind CSS, Leaflet |
| AI Orchestration | LangGraph + CopilotKit agent with tool calling |
| LLM | Gemini / Qwen-Plus (switchable via env) |
| Scoring | PAI-EAS propensity scoring + DashVector embeddings |
| Database | Supabase (PolarDB-compatible) |
| QR | HMAC-SHA256 signed Dynamic QR, 60s expiry, VietQR EMV |
| Auth | Clerk (merchant portal) |
| Testing | fast-check property-based tests, Jest |

---

## Prerequisites

- Node.js 18+
- pnpm 9+ (for merchant portal)
- npm 9+ (for backend and sol-app)

---

## Quick Start

### 1. Clone

```bash
git clone https://github.com/dzunglenguyen/sol-ai-loyalty.git
cd sol-ai-loyalty
```

### 2. Configure environment

```bash
# Backend
cp sol-ai-loyalty-poc/backend/.env.example sol-ai-loyalty-poc/backend/.env
# Edit .env with your Qwen/Supabase keys

# Merchant portal
cp merchant/.env.example merchant/apps/web/.env.local
# Edit .env.local with your Clerk, Supabase, and LLM keys

# Agent
# Create merchant/apps/agent/.env with LLM_PROVIDER and keys
```

### 3. Install dependencies

```bash
# Backend
cd sol-ai-loyalty-poc/backend
npm install

# SOL App
cd ../apps/sol-app
npm install

# Merchant portal (from repo root)
cd ../../merchant
pnpm install
```

### 4. Run all services

Open four terminals:

```bash
# Terminal 1 — Backend API (http://localhost:4000)
cd sol-ai-loyalty-poc/backend
node server.js

# Terminal 2 — SOL App (http://localhost:3001)
cd sol-ai-loyalty-poc/apps/sol-app
npm run dev

# Terminal 3 — Merchant Portal (http://localhost:3000)
cd merchant
pnpm --filter web dev

# Terminal 4 — AI Agent (http://localhost:8123)
cd merchant/apps/agent
npx @langchain/langgraph-cli dev --port 8123 --no-browser
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/offers?user_id=` | AI-ranked personalized offer feed |
| `GET` | `/api/explain-offer?user_id=&campaign_id=` | Qwen AI match explanation |
| `GET` | `/api/nearby-offers?user_id=&lat=&lng=&radius_km=` | Geo-filtered nearby offers |
| `POST` | `/api/qr/generate` | Dynamic QR generation (HMAC-SHA256) |
| `POST` | `/api/qr/verify` | QR verification + settlement |
| `POST` | `/api/orders` | Order creation and management |
| `GET` | `/health` | Backend health check |

---

## Key Features

**Merchant Portal**
- Natural language campaign creation via AI copilot (chat sidebar)
- Knowledge base: upload menus, space images, brand docs for AI context
- Real-time ROI estimation and campaign forecasting
- Revenue analytics dashboard with live updates
- VietQR POS scanner with automatic discount application

**SOL App (User)**
- AI-personalized offer feed with match score (80–98%)
- "Why am I seeing this?" AI explanation tooltips
- Nearby offers map (Leaflet) with merchant markers
- Geo-triggered push notifications within 1km radius
- Dynamic QR checkout — payment + voucher in one scan

**Backend**
- Mock PAI-EAS propensity scoring (cosine similarity)
- Qwen-Plus offer explanations
- HMAC-SHA256 signed QR with 60s expiry
- Haversine distance-based geo-filtering
- Graceful fallback when AI services are unavailable

---

## Environment Variables

### Backend (`sol-ai-loyalty-poc/backend/.env`)

| Variable | Description |
|---|---|
| `QWEN_API_KEY` | Alibaba Model Studio API key |
| `QWEN_MODEL` | Model name (default: `qwen3.5-flash`) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon/service key |
| `ALIBABA_QR_SECRET` | 32-char secret for QR HMAC signing |
| `PORT` | Server port (default: 4000) |

### Merchant Agent (`merchant/apps/agent/.env`)

| Variable | Description |
|---|---|
| `LLM_PROVIDER` | `gemini`, `dashscope`, or `xai` |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GEMINI_MODEL` | Model name (default: `gemini-2.5-flash`) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

> Without real cloud credentials, the backend uses mock scoring and seed data — fully functional for demos.

---

## Running Tests

```bash
# Backend property-based tests
cd sol-ai-loyalty-poc/backend
npm run test:run

# SOL App tests
cd sol-ai-loyalty-poc/apps/sol-app
npm run test:run

# Merchant portal tests
cd merchant
pnpm --filter web test:run
```

---

## Design System

UI follows the **Shinhan SOL** design language:

| Token | Value |
|---|---|
| Primary blue | `#0046BE` |
| Deep navy | `#00397F` |
| Accent orange | `#FF6B00` |
| Success green | `#00B14F` |
| Card radius | `12px` |
| Button radius | `24px` |
| Font | Tahoma / Inter |

---

## Team

Built in 2 weeks by a team of 4 (3 AI/Dev engineers + 1 Cloud Architect) for Global Shinhan InnoBoost 2026.

---

## License

MIT
