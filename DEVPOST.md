# SOL-AI: Turning Shinhan SOL into a Self-Serve, AI-Driven Loyalty Engine

## 💡 Inspiration

Shinhan Bank Vietnam has built a robust digital foundation with the SOL app, but we spotted a critical gap: the loyalty ecosystem is fragmented. Promotions on Shinhan Zone are static, requiring slow, manual B2B negotiations between the bank and merchants. Meanwhile, local SME merchants lack the tools to independently target Shinhan's massive user base — and users suffer from "app fatigue," juggling one app for vouchers and another to scan a payment QR.

We asked: *What if Shinhan SOL could become a self-serve, AI-driven marketing engine?* One that shifts the cost of rewards away from the bank, empowers merchants with GenAI, and creates a seamless "One-Scan" experience for users — all without requiring a separate app.

---

## 🚀 What It Does

SOL-AI is a **B2B2C loyalty infrastructure** built natively into the Shinhan SOL ecosystem. It transforms loyalty from a cost center into a **profit center** by letting merchants self-fund campaigns while Shinhan earns platform fees.

### Revenue Generation Model

| Revenue Stream | Description |
|---|---|
| Campaign listing fee | Merchants pay to publish AI-generated campaigns to SOL users |
| Transaction commission | Shinhan earns a % on every voucher-settled payment |
| Data insights fee | Aggregated spending analytics sold back to merchants |
| Increased MAU & spend | Personalized offers drive higher transaction volume and user retention |

### Three Core Pillars

**1. Merchant Campaign Builder (B2B)**
A self-serve portal where merchants use natural language to create campaigns. A café owner types *"20% off for Gen Z on rainy afternoons"* and our AI generates the targeting rules, discount logic, budget estimation, and push notification copy — all in seconds.

**2. Geo-Triggered Personalized Feed (B2C)**
Natively inside SOL, users see a hyper-personalized offer feed ranked by AI propensity scoring. When they enter a merchant's geofence, they receive a contextual push notification with a relevant offer.

**3. One-Scan Dynamic QR**
A single, time-sensitive Dynamic QR code is generated combining payment amount and voucher data. The merchant scans it, and the system instantly settles the payment and applies the discount — one scan, done.

---

## 🛠️ How We Built It

As a team of 4 (3 AI/Dev engineers + 1 Cloud Architect), we built a fully functional prototype in two weeks using the Alibaba Cloud ecosystem as our reference architecture.

### Architecture Overview

```
User/Merchant UI
      ↓
  API Gateway
      ↓
  Backend API
   ↙    ↘    ↘
PolarDB  DashVector  Alibaba Cloud AI
                     (Qwen, PAI-EAS,
                      Function Compute)
```

### 1. NLP to Campaign Logic (Qwen-Plus via Model Studio)

We integrated Qwen-Plus as our zero-shot extraction engine. The LLM processes the merchant's unstructured natural language prompt and transforms it into a strict JSON payload containing targeting parameters (radius, demographic, discount logic, budget, push message). The campaign is then stored in PolarDB for MySQL.

In our POC, we built this as a **CopilotKit + LangGraph agent** pipeline: the merchant chats in a sidebar, the LangGraph agent orchestrates tool calls (knowledge base lookup, merchant profile context, ROI analysis), and auto-populates a structured campaign form — with changed fields flashing to show the AI's work. The agent supports both English and Vietnamese prompts.

### 2. Real-Time Propensity Scoring (PAI-EAS + DashVector)

To ensure users only receive highly relevant offers, we calculate an **AI-Match score** per user-campaign pair. User behavioral embeddings are stored in DashVector. Our scoring model, deployed on PAI-EAS, computes cosine similarity between user and campaign vectors, then combines this with contextual weights (time of day, location proximity) to output a final propensity probability (0.0–1.0).

The offer feed gracefully degrades: if PAI-EAS is unavailable, offers fall back to creation-date sorting with a visible fallback indicator — no broken experience.

### 3. Geofencing & Push Triggers (Function Compute)

Alibaba Cloud Function Compute serverless scripts evaluate the user's live coordinates against merchant geofence boundaries. When a match is detected, the API Gateway fires a real-time push notification to the SOL App. We implemented de-duplication per campaign to prevent notification spam.

### 4. Dynamic QR Generation (Function Compute + HMAC-SHA256)

Each Dynamic QR encodes merchant ID, payment amount, and voucher logic into a single HMAC-SHA256 signed payload with a 60-second expiry. The merchant's POS scanner decodes and verifies the signature server-side without a network round-trip, then atomically settles the payment and increments the campaign's redemption count.

### 5. Merchant Knowledge Base (RAG)

Merchants upload menus, space images, and brand voice documents. Our AI extracts text via vision models and stores it as retrievable context. When the merchant asks the AI to create a campaign, the agent queries this knowledge base to generate personalized, context-aware suggestions — a café's AI knows its menu items, price range, and ambiance.

### 6. VietQR Payment Integration

We implemented EMV-compliant VietQR generation with CRC-16/CCITT checksums, using Shinhan Bank's NAPAS BIN. The POS system supports product catalog browsing, cart management, and automatic discount application (percentage, fixed amount, buy-X-get-Y, free shipping) before generating the payment QR.


### Tech Stack

| Layer | Technology | Role |
|---|---|---|
| **Frontend** | Next.js 15, React 19, Tailwind CSS | Merchant Portal, SOL App (PWA), POS Scanner |
| **AI Orchestration** | CopilotKit + LangGraph | Agent-driven campaign creation with tool calling |
| **LLM** | Qwen-Plus (Model Studio) | Campaign generation, offer explanations, OCR extraction |
| **Scoring** | PAI-EAS + DashVector | Real-time propensity scoring with user embeddings |
| **Database** | PolarDB for MySQL | Campaigns, users, merchants, redemptions, transactions |
| **Serverless** | Function Compute | Dynamic QR generation, geofence evaluation |
| **Routing** | API Gateway | Central hub for all inter-module communication |
| **Auth** | Clerk (POC) → Keycloak (production) | Merchant authentication and session management |
| **Testing** | fast-check (property-based) | 26 correctness properties across all modules |

---

## 🚧 Challenges We Ran Into

**Taming the LLM for Strict JSON**
Ensuring Qwen-Plus consistently returned valid, structured JSON rather than conversational text required rigorous prompt engineering. We enforced strict JSON output via system prompts and built regex fallback logic to catch and repair malformed responses.

**Low-Latency AI Matching at the Geofence**
Running personalized scoring for users walking into a geofence demanded extreme low latency. We solved this by caching user embeddings in DashVector and pre-computing campaign vectors, reducing the scoring call to a single vector similarity lookup.

**Dynamic QR Payload Engineering**
Encoding merchant ID, payment amount, voucher logic, and a cryptographic signature into a single QR string that standard readers could parse — while maintaining a 60-second expiry window — took several iterations of our Function Compute logic and HMAC-SHA256 signing scheme.

**VietQR EMV Compliance**
Vietnam's VietQR standard requires precise EMV TLV encoding with CRC-16/CCITT checksums. Getting the byte-level encoding right for Shinhan's NAPAS BIN, while handling Vietnamese Unicode characters (diacritics in merchant names), required careful ASCII normalization and extensive property-based testing.

**Coordinating Three Modules in Two Weeks**
With three independent Next.js apps, a Node.js backend, and multiple AI service integrations, keeping the data contracts aligned across the team was a constant challenge. Property-based testing with fast-check became our safety net — 26 properties covering everything from campaign ID uniqueness to QR round-trip integrity.

---

## 🏆 Accomplishments We're Proud Of

**A Complete B2B2C Loop in 14 Days**
We connected the full cycle: Merchant intent → AI campaign generation → User matching → Geo-triggered notification → Dynamic QR checkout → Payment settlement. Every step works end-to-end.

**Deep Alibaba Cloud Integration**
We successfully architected around 6 Alibaba Cloud services (Model Studio/Qwen-Plus, PAI-EAS, PolarDB, DashVector, Function Compute, API Gateway) with a clear migration path from our POC stand-ins.

**AI That Actually Does the Work**
The CopilotKit + LangGraph agent doesn't just suggest — it fills out the entire campaign form, queries the merchant's knowledge base for context, calculates ROI projections, and publishes the campaign. A merchant with zero marketing experience can launch a targeted promotion in under 2 minutes.

**26 Property-Based Tests**
We wrote 26 fast-check properties covering: campaign ID uniqueness, JSON schema completeness, form round-trip integrity, QR payload signing/verification, single-use enforcement, settlement atomicity, sort order correctness, ROI calculation accuracy, VietQR EMV compliance, and more.

**Production-Ready Architecture Documentation**
We documented a complete on-premises deployment path mapping every cloud service to self-hosted equivalents (Kong Gateway, Keycloak, Qwen via vLLM, Milvus, MySQL InnoDB Cluster, OpenFaaS) — ready for Shinhan's private data center requirements.

**Solving a Real Business Problem**
This isn't a tech demo. We created a model where merchants self-fund campaigns, Shinhan earns platform fees, and users get personalized value — transforming loyalty from a **Cost Center** into a **Profit Center**.

---

## 📚 What We Learned

**GenAI's Biggest Value for SMEs Is Operational Automation**
Translating "messy human intent" into "strict database logic" democratizes marketing for small businesses. A phở shop owner who has never written a marketing brief can now launch a geo-targeted campaign by chatting in Vietnamese.

**Alibaba Cloud's Event-Driven Agility**
We discovered how fast we could deploy serverless algorithms using Function Compute. The QR signing function went from concept to production-ready in a single afternoon.

**Property-Based Testing Is a Hackathon Superpower**
With three modules and tight timelines, fast-check caught edge cases we never would have written manual tests for — like QR payloads that round-trip correctly even with maximum-length Vietnamese merchant names.

**Hackathon Prioritization**
We learned to ruthlessly prioritize the "Happy Path." Every feature we shipped works end-to-end for the demo scenario. We deferred edge cases and admin tooling to focus on the core loop that tells the story.

---

## 🚀 What's Next for SOL-AI

**Core Banking Integration**
Transitioning from Supabase mock ledgers to Shinhan's actual core banking APIs and Shinhan CMS for real payment settlement.

**Multi-Language Support for FDI Businesses**
Expanding the Qwen templates to natively support Korean for Korcham SME members operating in Vietnam — a natural fit for Shinhan's Korean business network.

**On-Premises Deployment**
We've already documented the full cloud-to-on-prem migration path (Kong, Keycloak, Qwen via vLLM, Milvus, MySQL InnoDB Cluster). The next step is containerized deployment inside Shinhan's private data center.

**Advanced ML Scoring**
Upgrading from cosine similarity to a trained propensity model incorporating transaction history, time-of-day patterns, weather data, and merchant category affinity.

**Merchant Analytics Marketplace**
Aggregated, anonymized spending insights sold back to merchants — creating a third revenue stream beyond campaign fees and transaction commissions.

---

## 🔧 Built With

- Alibaba Cloud API Gateway
- Alibaba Cloud DashVector
- Alibaba Cloud Function Compute
- Alibaba Cloud Model Studio (Qwen-Plus)
- Alibaba Cloud PAI-EAS
- Alibaba Cloud PolarDB for MySQL
- CopilotKit
- Clerk
- Express.js
- fast-check
- html5-qrcode
- LangGraph
- Leaflet
- Next.js
- Node.js
- React
- Supabase
- Tailwind CSS
- TypeScript
