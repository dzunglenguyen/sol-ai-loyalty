# SOL AI Loyalty POC

A hackathon prototype for **Global Shinhan InnoBoost 2026** (Financial Services Track) — an AI-powered loyalty and personalized offers engine built natively into the Shinhan Bank SOL app ecosystem.

## Overview

SOL AI Loyalty connects SME merchants with SOL app users through hyper-personalized, location-aware offers powered by Alibaba Cloud AI. Merchants self-serve campaign creation via natural language; users receive ranked offers and pay with a single Dynamic QR — no separate app required.

### Three Modules

| Module | Description 
|---|---|
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
