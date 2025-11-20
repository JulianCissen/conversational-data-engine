# Product Requirement Document: Conversational Data Engine (Project Name TBD)

## 1. Executive Summary

We are building an open-source, configuration-driven Conversational Form Platform. Instead of static grids and inputs, users interact with an AI Agent to provide data. The system strictly adheres to business logic and data schemas (preventing hallucinations) while offering a natural, "consultative" user experience. It is designed for the European market, prioritizing GDPR compliance, Data Sovereignty, and Accessibility (WCAG).

## 2. User Personas

### 2.1 The Applicant (End User)

- **Goal:** Wants to submit a request (expense, permit, registration) as quickly and easily as possible.
- **Pain Point:** Hates rigid forms, doesn't understand complex "bureaucratic" questions, gets frustrated by "validation errors" they don't understand.
- **Interaction:** Chats with an AI that guides them, allows them to paste unstructured info, and answers their questions about why data is needed.

### 2.2 The Administrator (Builder)

- **Goal:** Needs to define complex data collection processes without writing an entire custom app.
- **Pain Point:** Needs to enforce strict validation (Regex, conditional logic) and integrate with internal systems.
- **Interaction:** Writes JSON/Code configurations (Blueprints) that define the Schema, Logic, and Lifecycle Hooks.

### 2.3 The Assessor (Reviewer)

- **Goal:** Needs to verify the data collected is accurate.
- **Interaction:** Views a structured summary of the data alongside the chat transcript. Can "inject" questions back into the chat if clarification is needed.

## 3. Functional Requirements

### 3.1 The Intelligence Engine (NLU & NLG)

- **Model Hosting:** Must support OpenAI-compatible APIs pointing to sovereign EU hosting (Scaleway).
- **NLU (Understanding):** The system must be able to extract structured data (JSON) from unstructured user text ("One-Shot" extraction).
- **NLG (Generation):** The system must generate polite, context-aware questions based on the next missing field in the Schema.
- **Context Awareness:** The AI must be able to answer user FAQs using context provided in the Service Definition.

### 3.2 The Orchestrator (State Machine)

- **Deterministic Logic:** The flow of questions must be determined by code, not the AI.
- **Schema Support:** Must support JSON Schema for defining fields and validation rules.
- **Dependency Logic:** Must support conditional visibility (Show Field X only if Field Y equals 'Z').
- **Looping:** Must support "Input Lists" (Sub-forms) where users can add N items (e.g., family members, expenses).

### 3.3 The Lifecycle System

- **Plugin Architecture:** A Node.js-based plugin system to handle external integrations.
- **Hooks:**
    - `onStart`: Prefill data / Auth checks.
    - `onChange`: Real-time validation or data enrichment (API lookups).
    - `onSubmit`: Final data egress (API POST, Email, File generation).

### 3.4 The User Interface

- **Framework:** Vue 3 + Vuetify (Material Design 3).
- **Accessibility:** WCAG 2.1 AA Compliant.
- **Hybrid Input:**
    - **Primary:** Text Chat.
    - **Secondary:** Rich Widgets rendered within chat bubbles (Date Pickers, File Uploads, Option Chips) when text input is inefficient.

## 4. Technical Architecture

### 4.1 Stack

- **Frontend:** Vue 3, Pinia (State), Vuetify.
- **Backend:** Node.js (NestJS or Fastify recommended), TypeScript.
- **Database:** PostgreSQL (using JSONB for flexible form state storage).
- **Validation:** Zod (compiled from JSON Schema).
- **AI Layer:** LangChain.js / Vercel AI SDK connecting to Scaleway (Llama 3 / Mistral).

### 4.2 Data Flow

1. **Config:** Admin defines `service.json` (Schema + Logic).
2. **Session:** User starts chat -> Backend initializes SessionState in DB.
3. **Loop:**
    - Backend calculates NextRequiredField.
    - Backend prompts AI with context.
    - AI asks User.
    - User responds.
    - AI extracts Intent & Data.
    - Backend Validates Data (Zod).
    - Repeat.

## 5. Security & Compliance

- **GDPR:**
    - No user data sent to US-based LLM providers.
    - PII Redaction options before storage (future scope).
    - "Right to be Forgotten" supported by deleting Session rows.
- **Input Sanitization:** All user input (even if extracted by AI) must pass Zod validation before DB storage.

## 6. MVP Roadmap (Phase 1)

The goal of the MVP is to prove the "Conversation > Form" hypothesis.

- **Story 1: The Skeleton.**
    - Setup Node.js backend and Vue frontend.
    - Create a hardcoded "Service Definition" (e.g., a simple Contact Form).
- **Story 2: The Brain.**
    - Implement the `determineNextState` logic (The Router).
    - Connect to Scaleway/LLM to generate questions.
- **Story 3: The Ear.**
    - Implement the extraction logic (User Text -> JSON).
    - Implement Zod validation.
- **Story 4: The List.**
    - Implement the "Stack" logic to handle a dynamic list of items (e.g., "List your vehicles").
- **Story 5: The UI.**
    - Build the Chat Interface using Vuetify.
