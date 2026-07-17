---
sidebar_position: 1
---

# Introduction

## What is UGM-AICare?

UGM-AICare is a proactive mental health support platform built specifically for students at **Universitas Gadjah Mada (UGM)**. In plain terms: it is an AI-powered companion that listens, assesses risk, provides evidence-based support, connects students to human counsellors when needed - and does all of this through a natural conversation.

The project began as a bachelor's thesis in Information Engineering at UGM's Department of Electrical and Information Engineering (DTETI), developed by **Giga Hidjrika Aura Adkhy** and **Ega Rizky Setiawan**.

---

## The Problem It Solves

University mental health services worldwide share a common structural failure: they are **reactive**. Students must recognise they have a problem, overcome the stigma of seeking help, navigate administrative barriers, and wait for an appointment - all while their condition may be deteriorating.

Three specific pressures make this worse at scale:

1. **Capacity gaps.** Counsellor-to-student ratios commonly exceed 1:1,000. No human team can monitor for early distress signals across an entire campus.
2. **Blind spots in data.** Without real-time information about population-level trends, mental health services cannot prioritise resources or plan proactively.
3. **Cultural friction.** In the Indonesian university context, stigma around mental health disclosures runs high. Students are less likely to self-refer into formal services.

---

## The Hypothesis

A conversational AI agent that:

- feels like a low-stakes friend to chat with (removing stigma friction),
- is continuously monitoring for distress signals in the background (removing the self-report bottleneck),
- and can escalate to human professionals precisely when needed (removing the capacity bottleneck),...may meaningfully shift the support paradigm from **reactive** to **proactive**.

UGM-AICare is the proof-of-concept testing that hypothesis.

---

## How It Works - In One Paragraph

A student opens the app and starts a conversation with **Aika**, the system's friendly AI persona. Aika listens empathetically and responds naturally. Behind the scenes, every message is simultaneously routed through a **Safety Triage Agent (STA)** that scores the message for risk. Depending on that score, a **Therapeutic Coach Agent (TCA)** may generate a structured coping plan, or a **Case Management Agent (CMA)** may open a clinical case and schedule a counsellor appointment. After the conversation ends, the STA runs a deeper analysis to detect longer-term risk patterns. An **Insights Agent (IA)** aggregates anonymised data across all conversations so counsellors and administrators can see population-level trends - without ever exposing individual identities.

---

## Who Is This Documentation For?

| Audience | What you'll find useful |
|---|---|
| **Developers** | Architecture diagrams, agent graphs, API references, and deployment guides |
| **Researchers** | Agent design rationale, the BDI model, screening methodology, and privacy mechanisms |
| **Counsellors / Clinical staff** | How the STA generates risk scores, what a CMA case looks like, and how to interpret IA dashboards |
| **General / Non-technical** | The [Architecture Overview](./architecture/system-overview) and individual agent pages are written to be readable without a technical background |

---

## Quick Links

- [System Architecture Overview](./architecture/system-overview)
- [How the Agentic Framework Works](./architecture/agentic-framework)
- [Meet Aika](./architecture/meta-agent-aika)
- [Technology Stack](./engineering/tech-stack)
- [Running the Project Locally](./deployment/setup)
