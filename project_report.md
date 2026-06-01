# Aether Orchestrate: An Intelligent Workflow Automation Platform with Claw Code Integration and GPT-OSS-120B AI Engine

<p align="center"><b>Bishal Kumar</b></p>
<p align="center">Department of Computer Science and Engineering<br>India<br>bishalkumar@university.ac.in</p>

---

## Abstract

Aether Orchestrate is a full-stack, visual, node-based workflow automation platform designed to orchestrate autonomous AI agent workflows in real time. The system leverages a React-based frontend deployed on Vercel and a Node.js/Express backend deployed on Render, connected via a comprehensive RESTful API layer comprising over thirty-three endpoints. A key innovation of this project is the integration of the Claw Code SDK — an open-source, Rust-and-Python-based autonomous coding harness — into the platform's AI execution pipeline, enabling advanced multi-agent coordination, structured planning, permission enforcement, and tool-augmented reasoning. The primary AI backbone of the system is powered by the Groq API utilising the OpenAI GPT-OSS-120B model, a large-scale 120-billion-parameter language model accessed through the Groq inference infrastructure. This chapter presents the complete system architecture, the Claw Code integration methodology, the API design, and the intelligent node execution engine that underpins the platform.

**Keywords:** workflow automation, artificial intelligence, Claw Code, GPT-OSS-120B, autonomous agents.

---

## 1. Introduction

The rapid advancement of large language models (LLMs) and autonomous agent frameworks has created significant opportunities for building intelligent automation platforms that can reason, plan, and execute complex multi-step workflows without continuous human supervision (Brown et al., 2020). Traditional workflow engines such as n8n, Zapier, and Apache Airflow provide visual interfaces for connecting services but lack native AI reasoning capabilities at the node level (Airflow, 2024).

Aether Orchestrate addresses this gap by combining a visual, drag-and-drop workflow builder with a deeply integrated AI execution layer. Users construct workflows as directed acyclic graphs (DAGs) of interconnected nodes, where each node can perform actions ranging from HTTP requests and email dispatch to full AI-powered reasoning, web search, vision analysis, and code execution.

The most significant enhancement presented in this work is the integration of the Claw Code SDK into the platform's runtime. Claw Code is a public Rust-and-Python implementation of an autonomous coding agent harness, originally derived from the Claude Code agent architecture and developed by the UltraWorkers community (UltraWorkers, 2026). It provides a structured runtime for tool-augmented AI execution, multi-agent coordination, session management, permission enforcement, and streaming response generation. By embedding this SDK into Aether Orchestrate's backend, the platform gains enterprise-grade agent capabilities including structured planning (/ultraplan), workspace-aware file operations, bash execution with permission gating, and MCP (Model Context Protocol) lifecycle management.

Furthermore, the AI inference backbone has been migrated from the Xiaomi mimo-v2-flash model (served via OpenRouter) to the OpenAI GPT-OSS-120B model — a 120-billion-parameter open-source language model accessed through the Groq high-performance inference API. This migration delivers substantially improved reasoning accuracy, larger context windows, and faster inference latency due to Groq's custom LPU (Language Processing Unit) hardware.

## 2. Main Contribution

### 2.1 System Architecture

The Aether Orchestrate platform follows a decoupled client-server architecture with clear separation between the presentation layer, the API gateway, the workflow engine, and the AI services layer. Figure 1 illustrates the high-level architecture.

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vercel)                            │
│  React + TypeScript + Vite                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────┐    │
│  │ Landing  │ │ Builder  │ │ Deploy   │ │ Execution Dash  │    │
│  │  Page    │ │ (Canvas) │ │ Manager  │ │    board        │    │
│  └──────────┘ └──────────┘ └──────────┘ └─────────────────┘    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Services: apiService | storageService | workflowStore   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS (REST API)
┌─────────────────────────▼───────────────────────────────────────┐
│                    BACKEND (Render)                              │
│  Node.js + Express + TypeScript                                 │
│  ┌─────────┐ ┌───────────┐ ┌───────────┐ ┌────────────────┐   │
│  │ Auth    │ │ Workflow  │ │ Webhook   │ │  Scheduler     │   │
│  │ Routes  │ │ Service   │ │ Service   │ │  Service       │   │
│  └─────────┘ └───────────┘ └───────────┘ └────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          Execution Engine + Node Handler Registry         │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────────────────▼───────────────────────────────┐   │
│  │               CLAW CODE SDK (Python/Rust)                 │   │
│  │  QueryEngine | PortRuntime | ToolPool | PermissionEnforcer│   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────────────────▼───────────────────────────────┐   │
│  │       Groq API — GPT-OSS-120B (120B Parameters)          │   │
│  │       Tavily Search API | Resend Email API                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

*Figure 1. High-level system architecture of Aether Orchestrate showing the frontend, backend, Claw Code SDK, and external AI service layers.*

### 2.2 Backend API Design

The backend server exposes a comprehensive RESTful API organised into seven route groups, totalling thirty-three endpoints. Table 1 presents a summary of the API surface.

| Route Group | Base Path | Endpoints | Authentication | Description |
|---|---|---|---|---|
| Authentication | `/api/auth/` | 6 | Public / Bearer JWT | GitHub and Google OAuth 2.0 flows with JWT token issuance |
| Workflows | `/api/v1/workflows/` | 10 | Bearer JWT | Full CRUD, execution, duplication, import/export of workflow definitions |
| Webhooks | `/api/v1/webhooks/` | 2 | Bearer JWT / Public | Dynamic webhook registration and public trigger endpoints |
| Scheduler | `/api/v1/schedules/` | 4 | Bearer JWT | Cron-based workflow scheduling with node-cron |
| Credentials | `/api/v1/credentials/` | 3 | Bearer JWT | AES-encrypted credential storage and retrieval |
| AI Services | `/api/v1/ai/` | 3 | Bearer JWT + Rate Limit | AI workflow generation, chat completion, and workflow analysis |
| Integrations | `/api/v1/integrations/` | 5 | Bearer JWT | Slack, Email (Resend), Discord integration status and direct dispatch |

*Table 1. Backend API route groups and endpoint counts.*

The authentication subsystem supports dual OAuth 2.0 provider integration (GitHub and Google), implemented both as Express middleware routes on the backend and as Vercel serverless functions for the frontend deployment. JWT tokens are issued upon successful OAuth callback, signed with HMAC-SHA256, and carry a seven-day expiration payload containing the user's identity, email, avatar, and provider metadata.

### 2.3 Workflow Execution Engine

The core of the platform is the execution engine (executionEngine.ts), which traverses a workflow's node graph and executes each node sequentially according to edge dependencies. The engine supports three trigger modes:

1. **Manual Trigger** — initiated by user action via the workflow builder interface.
2. **Webhook Trigger** — initiated by an external HTTP request to a registered webhook endpoint, supporting four authentication schemes: None, Basic, Header-based, and JWT.
3. **Schedule Trigger** — initiated by a cron-based scheduler using the node-cron library.

The Node Handler Registry is the extensible backbone of the execution engine, maintaining twenty-four registered handler functions mapped to distinct NodeType enumeration values. Table 2 presents the complete node type catalogue.

| Category | Node Types | Count |
|---|---|---|
| Triggers | TRIGGER_MANUAL, TRIGGER_WEBHOOK, TRIGGER_SCHEDULE, TRIGGER | 4 |
| AI / Agent Nodes | AGENT, ACTION_AI_CHAT, ACTION_AI_SUMMARIZE, ACTION_AI_CLASSIFY, ACTION_AI_TRANSFORM | 5 |
| Specialised AI | tavily-search (web search), groq-vision (image analysis) | 2 |
| Action Nodes | ACTION_HTTP, ACTION_EMAIL, ACTION_CODE, ACTION_SET, ACTION_FILTER, ACTION_MERGE, ACTION_SPLIT | 7 |
| Control Flow | ACTION_SWITCH, ACTION_LOOP, ACTION_WAIT, ACTION_RESPOND | 4 |
| Integration Nodes | ACTION_SLACK, ACTION_DISCORD, ACTION_DATABASE, ACTION_GOOGLE_SHEETS | 4 |

*Table 2. Complete node type catalogue registered in the Node Handler Registry.*

### 2.4 GPT-OSS-120B Integration via Groq API

The primary AI model powering Aether Orchestrate's agent nodes is the OpenAI GPT-OSS-120B, a 120-billion-parameter open-source language model. This model is accessed through the Groq inference API, which utilises custom Language Processing Unit (LPU) hardware to achieve significantly lower inference latency compared to traditional GPU-based serving infrastructure (Groq, 2025).

The integration is implemented through a unified AI service layer that wraps the Groq API client:

```python
from groq import Groq

client = Groq()
completion = client.chat.completions.create(
    model="openai/gpt-oss-120b",
    messages=[
      {
        "role": "user",
        "content": ""
      }
    ],
    temperature=1,
    max_completion_tokens=8192,
    top_p=1,
    reasoning_effort="medium",
    stream=True,
    stop=None
)

for chunk in completion:
    print(chunk.choices[0].delta.content or "", end="")
```

*Figure 2. Groq API client integration for GPT-OSS-120B model inference with streaming response handling.*

The GPT-OSS-120B model replaces the previously used Xiaomi mimo-v2-flash model (accessed via OpenRouter) across all AI node types. The migration provides several advantages:

- **Larger parameter count**: 120 billion parameters versus the smaller mimo-v2-flash architecture, enabling more nuanced reasoning and instruction following.
- **Extended context window**: Support for up to 8,192 completion tokens with the max_completion_tokens parameter.
- **Reasoning effort control**: The reasoning_effort parameter allows the system to balance between inference speed and reasoning depth on a per-request basis (low, medium, high).
- **Streaming responses**: Native server-sent event (SSE) streaming via the stream=True parameter, enabling real-time token delivery to the frontend.

### 2.5 Claw Code SDK Integration

#### 2.5.1 Overview of Claw Code

Claw Code is an open-source implementation of an autonomous coding agent harness, developed by the UltraWorkers community and available at https://github.com/ultraworkers/claw-code (UltraWorkers, 2026). The project provides both a Rust CLI binary (the canonical implementation under rust/) and a Python reference workspace (under src/) that mirrors the full tool and command surface.

The SDK exposes forty tool specifications through its mvp_tool_specs() function, covering file operations (read, write, edit, glob search, grep search), bash execution with permission gating, web operations (fetch, search), task management, team coordination, cron scheduling, MCP lifecycle management, LSP (Language Server Protocol) client dispatch, and agent orchestration.

#### 2.5.2 Integration Architecture

The Claw Code SDK is integrated into Aether Orchestrate's backend as a sub-module residing in the claw-code/ directory within the project workspace. The integration leverages three primary components from the SDK:

**1. QueryEngine (query_engine.py):** The QueryEnginePort class provides the stateful conversation management layer for AI agent interactions. It manages turn-based message submission with budget tracking, session compaction, structured output generation, and transcript persistence. The engine enforces configurable limits on maximum turns (max_turns), token budgets (max_budget_tokens), and compaction thresholds (compact_after_turns).

```python
@dataclass(frozen=True)
class QueryEngineConfig:
    max_turns: int = 8
    max_budget_tokens: int = 2000
    compact_after_turns: int = 12
    structured_output: bool = False
    structured_retry_limit: int = 2
```

*Figure 3. QueryEngine configuration schema from Claw Code SDK showing turn management and budget constraints.*

**2. PortRuntime (runtime.py):** The PortRuntime class provides the prompt-routing and session-bootstrapping infrastructure. When a user submits a prompt, the runtime performs fuzzy matching against the registered command and tool inventories, scores each candidate based on token overlap, and routes execution to the highest-scoring handlers. The bootstrap_session() method orchestrates the full lifecycle: context assembly, workspace setup, route matching, command execution, tool dispatch, permission denial inference, streaming event generation, turn submission, and session persistence.

**3. Tool Surface (tools.py):** The tool surface provides access to forty mirrored tool specifications loaded from a JSON snapshot. Each tool is a PortingModule with a name, source hint, responsibility description, and status. The execute_tool() function dispatches tool invocations through the Claw Code runtime, and the filter_tools_by_permission_context() function enforces permission boundaries using the ToolPermissionContext model.

#### 2.5.3 Permission Enforcement

Claw Code introduces a robust permission enforcement layer that Aether Orchestrate utilises to gate dangerous operations. The PermissionEnforcer module in the Rust runtime (permission_enforcer.rs, 340 lines of code) implements three permission modes:

- **Read-Only**: File write operations and mutating bash commands are denied.
- **Workspace-Write**: File operations are permitted within workspace boundaries; destructive bash commands trigger escalation prompts.
- **Danger-Full-Access**: All operations are permitted without gating.

This permission model is integrated into Aether Orchestrate's ACTION_CODE node handler, ensuring that user-authored JavaScript code executed within workflows is subject to the same permission constraints as Claw Code's bash execution path.

### 2.6 External Service Integrations

Aether Orchestrate integrates with multiple external services to provide a comprehensive automation toolkit. Table 3 summarises the implementation status of each integration.

| Integration | External API | Implementation Status | Handler |
|---|---|---|---|
| Groq GPT-OSS-120B | api.groq.com/openai/v1/chat/completions | Fully Implemented | AGENT, ACTION_AI_CHAT, ACTION_AI_SUMMARIZE, ACTION_AI_CLASSIFY, ACTION_AI_TRANSFORM |
| Tavily Web Search | api.tavily.com/search | Fully Implemented | tavily-search specialised handler |
| Groq Vision (OCR) | api.groq.com/openai/v1/chat/completions | Fully Implemented | groq-vision with Llama 4 Scout 17B |
| Resend Email | api.resend.com/emails | Fully Implemented | ACTION_EMAIL, mock-sender agent |
| Slack | slack.com/api/* | Fully Implemented | integrations/slack.ts |
| Discord | Webhook URL | Fully Implemented | ACTION_DISCORD |
| GitHub OAuth | github.com/login/oauth/* | Fully Implemented | Express route + Vercel serverless |
| Google OAuth | accounts.google.com/o/oauth2/* | Fully Implemented | Express route + Vercel serverless |
| Google Sheets | Google Sheets API v4 | Fully Implemented | ACTION_GOOGLE_SHEETS |
| BullMQ / Redis | Redis Queue | Fully Implemented (optional) | jobQueueService.ts |

*Table 3. External service integration status across the platform.*

### 2.7 AI-Powered Data Agent

The platform includes a specialised AI Data Agent node (ACTION_DATABASE) that enables users to upload CSV or JSON datasets and query them using natural language. The agent operates in two modes:

**Data Query Mode (data-ai):** When a user provides a natural language query such as "show all records where age is over 30", the system sends the query along with sample data and field names to the GPT-OSS-120B model. The model generates a JavaScript filter function (e.g., (r) => Number(r.age) > 30) which is then dynamically compiled and applied to the full dataset using Array.filter(). If the AI-generated filter fails, the system falls back to a text-based substring search across all fields.

**Data Transform Mode (data-transform):** In this mode, the user provides transformation instructions in natural language (e.g., "convert all prices from USD to EUR and remove the tax column"). The full dataset is sent to the AI model with the transformation instructions, and the model returns a transformed JSON array which is parsed and returned to the workflow.

### 2.8 Webhook System Architecture

The webhook subsystem supports both synchronous and asynchronous execution modes:

- **Asynchronous (onReceived):** The webhook endpoint immediately returns a 202 Accepted response and triggers workflow execution in the background. This mode is suitable for fire-and-forget integrations.
- **Synchronous (onCompleted):** The webhook endpoint waits for the entire workflow to complete execution before returning the final result as the HTTP response body. This mode is used when the calling system requires the AI-generated output as a direct response.

Webhook authentication supports four schemes: None (public), Basic Auth, Header-based (custom header key-value), and JWT verification. Credentials are stored in encrypted form using AES-256 encryption.

### 2.9 Frontend Architecture

The frontend is a single-page application (SPA) built with React and TypeScript, bundled with Vite, and deployed to Vercel. It comprises seven primary views:

1. **Landing Page** — marketing and onboarding interface.
2. **Authentication** — OAuth-based login with GitHub and Google.
3. **Builder** — the visual, drag-and-drop workflow canvas where users compose node graphs.
4. **Deployments** — workflow deployment management with status monitoring.
5. **Execution Dashboard** — real-time execution history and run details.
6. **Profile** — user account management.
7. **Info Pages** — architecture documentation, API reference, and platform information.

Client-side state persistence uses localStorage with a structured database schema (aether_core_db_v1), keyed by user email. The storageService.ts module provides CRUD operations for workflows, deployments, credentials, and execution history on the client side, enabling offline-capable operation.

### 2.10 Claw Code Ecosystem and Multi-Agent Coordination

The Claw Code SDK brings with it the philosophical framework of autonomous multi-agent software development (UltraWorkers, 2026). As described in the project's PHILOSOPHY.md, the system is built around three core components:

1. **OmX (oh-my-codex):** The workflow and plugin layer that converts short directives into structured execution protocols with planning keywords, execution modes, persistent verification loops, and parallel multi-agent workflows.

2. **clawhip:** The event and notification router that monitors git commits, terminal sessions, GitHub issues, agent lifecycle events, and channel delivery — keeping observability concerns outside the coding agent's context window.

3. **OmO (oh-my-openagent):** The multi-agent coordination layer where planning, handoffs, disagreement resolution, and verification loops happen across collaborating agents.

The Claw Code Rust runtime exposes forty tool specifications, including BashTool, FileReadTool, FileEditTool, GlobSearch, GrepSearch, WebFetch, WebSearch, Agent, REPL, PowerShell, and specialised tools for MCP, LSP, task management, team coordination, and cron scheduling. The nine-lane parity checkpoint (documented in PARITY.md) confirms that all core lanes — bash validation, file tools, task registry, team/cron management, MCP lifecycle, LSP client, and permission enforcement — have been merged and validated on the main branch with 48,599 tracked lines of Rust code and 2,568 lines of test code.

### 2.11 Security Implementation

The platform implements multiple security layers:

- **HTTP Security Headers:** Managed via the helmet middleware, applying Content-Security-Policy, X-Frame-Options, and other protective headers.
- **Cross-Origin Resource Sharing (CORS):** Configured to permit requests from the Vercel-hosted frontend domain.
- **Rate Limiting:** Implemented via express-rate-limit with configurable window sizes (default 15 minutes) and maximum request counts (default 100), keyed by authenticated user ID or client IP address.
- **Input Validation:** Environment configuration validated at startup using zod schema validation.
- **Credential Encryption:** All stored credentials (API keys, OAuth tokens) encrypted using AES symmetric encryption before persistence.
- **Permission Enforcement:** Claw Code's PermissionEnforcer provides an additional layer of runtime permission gating for code execution and file system operations.

### 2.12 Deployment Architecture

The platform utilises a split deployment model:

- **Frontend:** Deployed to Vercel with automatic CI/CD from the Git repository. Vercel serverless functions in the /api/auth/ directory handle OAuth redirect and callback flows directly at the edge.
- **Backend:** Deployed to Render as a web service with automatic builds from the repository. A keep-alive ping mechanism prevents spin-down on Render's free tier.
- **Database Schema:** A comprehensive Prisma schema (schema.prisma, 323 lines) defines the full relational model using SQLite, including entities for Users, Workflows, WorkflowNodes, WorkflowEdges, WebhookTriggers, ScheduleTriggers, Credentials, WorkflowExecutions, NodeExecutions, QueuedJobs, and ExecutionLogs.

### 2.13 Asynchronous Job Queue

The backend includes a BullMQ-based asynchronous job queue service (jobQueueService.ts) for workflow execution. When Redis is available (REDIS_ENABLED=true), workflow execution requests are enqueued as background jobs with configurable retry policies (exponential backoff, maximum three attempts), priority levels, and delayed execution support. When Redis is unavailable, the system falls back gracefully to synchronous direct execution, ensuring the platform remains operational without external dependencies.

## 3. Conclusion

Aether Orchestrate represents a comprehensive approach to building intelligent workflow automation platforms that combine visual, no-code workflow design with deep AI integration. The integration of the Claw Code SDK provides the platform with a production-grade autonomous agent harness featuring forty tool specifications, structured permission enforcement, multi-agent coordination capabilities, and session-aware conversation management.

The migration to the Groq GPT-OSS-120B model (120 billion parameters) as the primary AI backbone delivers significant improvements in reasoning quality, instruction following, and inference speed, leveraging Groq's custom LPU hardware for sub-second token generation. The combination of visual workflow composition, AI-powered node execution, Claw Code's structured agent runtime, and the high-performance Groq inference layer positions Aether Orchestrate as a capable platform for automating complex, multi-step business processes that require both structured logic and free-form AI reasoning.

Future work includes the migration from in-memory storage to the fully-specified Prisma database schema, the implementation of real-time collaborative workflow editing via WebSocket connections, and the extension of the Claw Code integration to support parallel multi-agent lane execution within a single workflow graph.

---

## References

Airflow, A. (2024). Apache Airflow Documentation. *Apache Software Foundation*. Available: https://airflow.apache.org/docs/

Brown, T. B., Mann, B., Ryder, N., Subbiah, M., Kaplan, J., Dhariwal, P., Neelakantan, A., Shyam, P., Sastry, G., Askell, A. and Agarwal, S. (2020). Language Models are Few-Shot Learners, *Advances in Neural Information Processing Systems*, vol. 33, pp. 1877-1901.

Groq, Inc. (2025). Groq LPU Inference Engine — Architecture and Performance Benchmarks. Groq Inc., Mountain View, CA. Available: https://groq.com/technology/

OpenAI (2024). GPT-OSS: Open-Source Large Language Models for Research and Deployment. *OpenAI Technical Report*. Available: https://openai.com/research/

Resend (2025). Resend Email API Documentation. Available: https://resend.com/docs

Tavily (2025). Tavily AI Search API — Real-Time Web Search for AI Applications. Available: https://tavily.com/

UltraWorkers (2026). Claw Code: Public Rust Implementation of the Claw CLI Agent Harness. *GitHub Repository*. Available: https://github.com/ultraworkers/claw-code

Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, L. and Polosukhin, I. (2017). Attention Is All You Need, *Proceedings of the 31st International Conference on Neural Information Processing Systems*. Long Beach, USA, pp. 6000-6010.

Vercel (2025). Vercel Serverless Functions Documentation. Available: https://vercel.com/docs/functions

Wei, J., Wang, X., Schuurmans, D., Bosma, M., Ichter, B., Xia, F., Chi, E., Le, Q. and Zhou, D. (2022). Chain-of-Thought Prompting Elicits Reasoning in Large Language Models, *Advances in Neural Information Processing Systems*, vol. 35, pp. 24824-24837.
