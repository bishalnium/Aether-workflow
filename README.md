# Aether: Next-Gen AI-Driven Workflow Automation Platform

Aether is a visual, no-code/low-code workflow automation platform (similar to n8n or Zapier) supercharged with **AI Agents, LLM-based data mapping, and RAG-powered loops**. Build robust workflows with drag-and-drop nodes, schedule cron triggers, register HTTP webhooks, and let AI process, query, and structure data in real-time.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)
![Database](https://img.shields.io/badge/Database-PostgreSQL%20(Aiven)-orange.svg)

---

## ✨ Features

- **🎮 Interactive Workflow Builder**: Sleek visual canvas built on **React Flow** with frosted glassmorphic UI, responsive grids, and micro-animations.
- **💾 Cloud Database Persistence**: Fully integrated with **Aiven PostgreSQL** using **Prisma ORM**. All workflows, edges, nodes, executions, credentials, and logs are 100% persisted.
- **🔐 Secure OAuth Authentication**: Built-in GitHub and Google OAuth login flows.
- **🔄 Multi-Agent Orchestration & RAG**:
  - **RAG Search Loop**: Optimizes user prompts, queries DuckDuckGo/Tavily search APIs, and recursively evaluates findings using a validator LLM before routing data downstream.
  - **Summarization & Classification**: Built-in nodes for parsing, summarizing, and categorizing data.
- **🗺️ LLM Auto-Mapping**: Automatically parses raw unstructured user inputs and formats them into structured JSON arrays or key-value objects matching Google Sheets or SQL Database schemas.
- **⏰ Scheduled & Webhook Triggers**:
  - **Cron Scheduler**: Schedule automations using standard cron notation. Runs are restored from PostgreSQL dynamically on container restart.
  - **Webhooks**: Sync mode (awaits workflow results and returns custom REST responses from `ACTION_RESPOND` node) or Async mode.
- **🔌 Comprehensive Integrations**: Stubs and drivers for Email (Resend API), Slack, Telegram, Notion, GitHub API, Firebase, Google Sheets, and PostgreSQL/SQLite databases.
- **🛡️ Sandbox JavaScript Execution**: Securely run custom JS code scripts directly inside workflows.

---

## 🛠️ The Tech Stack

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **Graph Editor**: React Flow (v11)
- **State Management**: Zustand
- **Styling**: Vanilla CSS (glassmorphism/dark theme) + Lucide Icons

### Backend
- **Runtime**: Node.js + Express + TypeScript + tsx
- **ORM**: Prisma Client v7
- **Scheduler**: node-cron
- **Mailing**: Resend API
- **AI Routers**: Groq API (GPT-OSS-120B, Llama-4-Scout), Gemini API, OpenRouter

### Database
- **Cloud Database**: Aiven PostgreSQL (never-pauses free tier)
- **Local Dev Database**: SQLite

---

## ⚙️ Environment Configuration

Create a `.env` file in the `backend/` directory:

```env
# Server
PORT=8080
NODE_ENV=development

# Authentication
JWT_SECRET=your-jwt-secret-key
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret

# Aiven PostgreSQL Database
DATABASE_URL="postgresql://avnadmin:password@aether-db.aivencloud.com:26407/defaultdb?sslmode=require"

# AI Models & Keys
GROQ_API_KEY_1=your-first-groq-key
GROQ_API_KEY_2=your-second-groq-key
GROQ_API_KEY_3=your-third-groq-key
GEMINI_API_KEY=your-gemini-key
OPENROUTER_API_KEY=your-openrouter-key

# Search & Integrations
TAVILY_API_KEY=your-tavily-search-key
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=onboarding@resend.dev
```

---

## 🚀 Installation & Local Startup

### 1. Clone the Repository
```bash
git clone https://github.com/bishalnium/Aether-workflow.git
cd Aether-workflow
```

### 2. Install Dependencies & Build Prisma
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
```

### 3. Sync Aiven Cloud Database
Ensure your `.env` contains the Aiven connection string. Push the database schema:
```bash
npx prisma db push
npx prisma generate
```

### 4. Start the Application

#### Start Backend (Terminal 1)
```bash
cd backend
npm run dev
```
*Backend runs on: **http://localhost:8080***

#### Start Frontend (Terminal 2)
```bash
# Back in Aether-workflow/
npm run dev
```
*Frontend runs on: **http://localhost:3000***

---

## 🎯 Usage & Testing Webhooks

We've provided scripts to test workflow deployment and webhook trigger persistence:

### 1. Run Webhook Integration Test (Deploy + Trigger)
This creates a workflow with a **Webhook Trigger** ➡️ **DuckDuckGo Search Agent** ➡️ **Resend Email Sender**, and pushes a payload:
```bash
node scratch/test_jis_university.js
```

### 2. Run Custom Webhook Test
Test any webhook with custom queries and recipient emails:
```bash
node scratch/test_custom_webhook.js <webhook_url> "<search_topic>" <recipient_email>
```

---

## 🎨 Node Catalog

### Triggers
- **TRIGGER_WEBHOOK**: Triggers execution on incoming HTTP payloads.
- **TRIGGER_SCHEDULE**: Runs at scheduled cron intervals.
- **TRIGGER_MANUAL**: Start manually from the editor.

### AI Agents
- **AGENT (gpt-oss-120b)**: Multi-turn LLM agent.
- **AGENT (ddg-search)**: RAG search validator agent.
- **AGENT (tavily-search)**: Web-scraping query agent.
- **AGENT (groq-vision)**: Visual OCR text extraction agent.

### Action Nodes
- **ACTION_HTTP**: Dispatches custom REST requests.
- **ACTION_EMAIL**: Sends emails via Resend.
- **ACTION_CODE**: Executes JavaScript scripts.
- **ACTION_RESPOND**: Sends custom JSON back to webhooks.

### Controls & Integrations
- **Google Sheets**: Reads/appends spreadsheet cells.
- **SQL Database**: Read/write sqlite & postgresql records.
- **Slack / Telegram / Discord / Notion / GitHub**: Dispatches bot alerts and queries APIs.
- **Control Flow**: Switch, Filter, Merge, Split, Loop, and Wait delay handlers.

---

## 📄 License
Licensed under the [MIT License](LICENSE).
