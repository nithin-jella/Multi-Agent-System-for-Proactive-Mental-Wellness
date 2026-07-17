---
sidebar_position: 1
---

# Frontend Overview

## What It Is

The frontend is a **Next.js 16** application written in TypeScript. It serves two distinct user experiences from the same codebase:

1. **The Chat Interface** - used by students to talk to Aika
2. **The Dashboard** - used by counsellors and administrators to monitor cases, analytics, and system health

---

## Directory Structure

```
frontend/src/
├── app/ # Next.js App Router
│ ├── (auth)/ # Login, registration pages
│ ├── (chat)/ # The student chat interface
│ ├── (dashboard)/ # Counsellor & admin dashboard
│ └── api/ # Next.js API routes (auth callbacks)
├── components/
│ ├── chat/ # Chat bubbles, input bar, typing indicator
│ ├── dashboard/ # Charts, case cards, risk tables
│ ├── ui/ # Reusable primitives (buttons, inputs, modals)
│ └── layout/ # Navbar, sidebar, page wrappers
├── hooks/ # Custom React hooks (useSSE, useConversation, …)
├── lib/
│ ├── api.ts # Typed API client (wraps fetch with auth headers)
│ └── auth.ts # NextAuth configuration
└── messages/ # i18n string files (en, id)
```

---

## Real-Time Streaming

Aika's responses stream token-by-token using **Server-Sent Events (SSE)**. The sequence is:

1. The frontend sends the user's message to `POST /api/v1/aika`
2. The backend immediately opens an SSE stream (`text/event-stream`) on the same response
3. As the backend executes the orchestrator and Gemini calls, it pushes progressive events/tokens through that stream
4. The frontend appends each token to the current message bubble in real-time

This produces the "typing" effect that makes Aika feel responsive rather than like a slow batch process.

---

## Authentication

The frontend uses **NextAuth.js** with a custom credentials provider backed by the FastAPI JWT system. After login, the JWT is stored in an HTTP-only cookie and attached to every API request via a custom `fetch` wrapper in `lib/api.ts`.

Role-based UI rendering: counsellors and admins are redirected to the dashboard on login; students see the chat. The `role` field from the JWT payload controls which routes and components are visible.

---

## Key UI Components

| Component | Purpose |
| --- | --- |
| `ChatBubble` | Renders a single message - handles Markdown, code blocks, lists |
| `TypingIndicator` | Animated dots shown while streaming is active |
| `RiskBadge` | Colour-coded badge showing a conversation's risk level (counsellors only) |
| `AppointmentCard` | Displays a scheduled appointment with reschedule/cancel actions |
| `RiskTrendChart` | Line chart of population risk scores over time (IA data) |
| `InterventionFunnel` | Sankey-style funnel from conversations → cases → resolutions |

---

## Internationalisation

The app supports both **English** and **Bahasa Indonesia**. Language selection is persisted in the user profile. All UI strings live in `messages/en.json` and `messages/id.json` - no hardcoded text in components.

Aika's conversational responses are in the language the student uses. If they write in Indonesian, Aika responds in Indonesian. This is handled at the LLM prompt level, not by the frontend.
