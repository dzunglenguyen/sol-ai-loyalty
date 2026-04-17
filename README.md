# SOL AI Loyalty POC

A hackathon prototype for **Global Shinhan InnoBoost 2026** (Financial Services Track) — an AI-powered loyalty and personalized offers engine built natively into the Shinhan Bank SOL app ecosystem.

## Overview

SOL AI Loyalty connects SME merchants with SOL app users through hyper-personalized, location-aware offers powered by Alibaba Cloud AI. Merchants self-serve campaign creation via natural language; users receive ranked offers and pay with a single Dynamic QR — no separate app required.

### Three Modules

| Module | Description | Port |
|---|---|---|
| `sol-app` | Simulated SOL PWA — AI-ranked offer feed, geo-trigger, Dynamic QR checkout 
| `merchant-portal` | Merchant campaign builder and ROI dashboard  
| `pos-scanner` | Merchant QR scan and one-step payment settlement  
| `backend` | Node.js/Express API server — campaigns, offers, QR, geo 

---

## Code Structure

```
sol-ai-loyalty-poc/
├── apps/
│   └── sol-app/                  # Next.js 14 PWA (user-facing)
│       ├── app/                  # App Router pages
│       │   ├── page.tsx          # SOL home screen
│       │   ├── vouchers/         # Offer feed + nearby map/list
│       │   └── offers/[id]/      # Offer detail + Dynamic QR
│       ├── components/           # Shared UI components
│       │   ├── TopNav.tsx
│       │   ├── BottomNav.tsx
│       │   ├── OfferCard.tsx
│       │   ├── MerchantMap.tsx   # Leaflet map (SSR-safe)
│       │   └── ...
│       ├── hooks/
│       │   └── useExplainOffer.ts  # Qwen-Plus AI explanation hook
│       ├── types/index.ts        # Shared TypeScript types
│       └── tailwind.config.ts    # Shinhan SOL brand tokens
│
└── backend/                      # Node.js Express API
    ├── server.js                 # Entry point
    ├── routes/                   # One file per domain
    │   ├── campaigns.js
    │   ├── offers.js
    │   ├── qr.js
    │   ├── geo.js
    │   └── events.js
    ├── services/                 # Alibaba Cloud clients
    │   ├── qwenClient.js         # Qwen-Plus (campaign gen, explanations)
    │   ├── paiEasClient.js       # PAI-EAS propensity scoring
    │   ├── dashVectorClient.js   # DashVector user embeddings
    │   └── qrService.js          # HMAC-SHA256 Dynamic QR

```

---

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS, Leaflet
- **Backend**: Node.js, Express
- **AI/ML**: Alibaba Cloud Qwen-Plus (campaign generation, offer explanations), PAI-EAS (propensity scoring)
- **Data**: PolarDB for MySQL, DashVector (user embeddings)
- **QR**: HMAC-SHA256 signed Dynamic QR, 60s expiry
- **Push**: Browser Web Push API

---

## Prerequisites

- Node.js 18+
- npm 9+

---

## Installation

```bash
# 1. Install backend dependencies
cd sol-ai-loyalty-poc/backend
npm install

# 2. Install sol-app dependencies
cd ../apps/sol-app
npm install
```

---

## Configuration

Copy the backend env example and fill in your Alibaba Cloud credentials:

```bash
cd sol-ai-loyalty-poc/backend
cp .env.example .env
```

Key variables in `.env`:

```
QWEN_API_KEY=          # Alibaba Model Studio API key
PAI_EAS_ENDPOINT=      # PAI-EAS scoring endpoint
PAI_EAS_TOKEN=         # PAI-EAS auth token
DASHVECTOR_API_KEY=    # DashVector API key
ALIBABA_QR_SECRET=     # 32-char secret for QR signing
PORT=4001
```

> Without real Alibaba Cloud credentials the backend falls back to mock data — the app is fully usable for demo purposes.

---

## Running Locally

Open two terminals:

```bash
# Terminal 1 — Backend (http://localhost:4001)
cd sol-ai-loyalty-poc/backend
PORT=4001 npm start

# Terminal 2 — SOL App (http://localhost:3001)
cd sol-ai-loyalty-poc/apps/sol-app
npm run dev
```

---

## Backend API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/get-personalized-offers?user_id=` | PAI-EAS ranked offer feed |
| `GET` | `/explain-offer?user_id=&campaign_id=` | Qwen-Plus match explanation |
| `GET/POST` | `/campaigns` | Campaign CRUD |
| `POST` | `/generate-campaign` | Natural language → campaign (Qwen-Plus) |
| `POST` | `/generate-qr` | Dynamic QR generation |
| `POST` | `/redeem` | QR validation + settlement |
| `POST` | `/geo-trigger` | Geofence match + push notification |

---

## Running Tests

```bash
# Backend property-based tests
cd sol-ai-loyalty-poc/backend
npm run test:run

# sol-app tests
cd sol-ai-loyalty-poc/apps/sol-app
npm run test:run
```

---

## Design System

UI follows the **Shinhan SOL** design language. Key tokens:

| Token | Value |
|---|---|
| Primary blue | `#0046BE` |
| Deep navy | `#00397F` |
| Accent orange | `#FF6B00` |
| Success green | `#00B14F` |
| Card radius | `12px` |
| Button radius | `24px` |
