# Product Requirement Document: Conversational Data Engine

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
- **Interaction:** Writes JSON configurations (Blueprints) that define the JSON Schema, JsonLogic rules, and Lifecycle Hooks.

### 2.3 The Assessor (Reviewer)
- **Goal:** Needs to verify the data collected is accurate.
- **Interaction:** Views a structured summary of the data alongside the chat transcript. Can "inject" questions back into the chat if clarification is needed.

## 3. Functional Requirements

### 3.1 The Intelligence Engine (NLU & NLG)
- **Model Hosting & Abstraction:** Uses **LangChain** to abstract the model provider.
    - *Development:* Supports OpenAI (GPT-3.5/GPT-4o) for cost-controlled testing.
    - *Production:* Targets OpenAI-compatible endpoints hosted in the EU (Scaleway) for GDPR compliance.
- **NLU (The Ear):** The system utilizes "Structured Outputs" (passing raw JSON Schemas to the LLM) to extract valid data from unstructured text.
- **NLG (The Mouth):** The system generates polite, context-aware questions. It creates distinct responses for:
    - First-time questions.
    - Validation error corrections (polite re-prompting).
    - Contextual FAQs (answering "Why?" based on Blueprint context).

### 3.2 The Orchestrator (State Machine)
- **Deterministic Logic:** The flow of questions is strictly determined by code, not the AI.
- **Logic Engine:** Uses **JsonLogic** (standardized JSON-based logic) to evaluate conditions.
- **Schema Support:** Uses **JSON Schema** for defining fields and validation rules.
- **Dependency Logic:** Support conditional visibility (e.g., Show Field X only if Field Y > 18).
- *Note: Complex Input Lists (Looping) are out of scope for the initial MVP.*

### 3.3 The Lifecycle System
- **Plugin Architecture:** A Node.js-based plugin system to handle external integrations.
- **Hooks:**
    - `onStart`: Prefill data / Auth checks.
    - `onChange`: Real-time validation or data enrichment (API lookups).
    - `onSubmit`: Final data egress (API POST, Email, File generation).

### 3.4 The User Interface
- **Framework:** Vue 3 + Vuetify (Material Design 3).
- **Layout:** Modern Chat Interface (Sidebar history, Fixed bottom input, Scrollable messages).
- **Accessibility:** WCAG 2.1 AA Compliant via Vuetify components.
- **Interaction:** REST-based communication (`POST /chat`) with Pinia state management.

### 3.5 Multi-Language Support
- **Configuration Levels:**
    - *System-Wide:* Default language mode and language code set via environment variables (`LANG_DEFAULT_MODE`, `LANG_DEFAULT_LANGUAGE`).
    - *Blueprint-Level:* Individual services can override defaults with their own language configuration.
- **Language Modes:**
    - *Adaptive:* AI automatically detects and adapts to the user's language while collecting data.
    - *Strict:* Enforces communication in a specific language only (e.g., legal/judicial compliance).
- **ISO-639 Compliance:** All language codes use ISO-639 format (e.g., `en-GB`, `nl-NL`, `de-DE`, `fr-FR`).
- **Detection:** System tracks the detected language for each conversation and can enforce language violations in strict mode.

## 4. Technical Architecture

### 4.1 Stack
- **Repository:** Monorepo (`packages/backend`, `packages/frontend`).
- **Frontend:** Vue 3, TypeScript, Pinia, Axios, Vuetify.
- **Backend:** NestJS (Modular Architecture).
- **Database:** PostgreSQL (Dockerized).
- **ORM:** **MikroORM** (using JSONB columns for flexible session state).
- **Logic:** `json-logic-js`.
- **AI Layer:** `@langchain/openai` (Configurable for Scaleway/OpenAI/Ollama).

### 4.2 Data Flow (The Coordinator Loop)
1. **Config:** Admin defines `service.json` (Blueprint).
2. **Session:** User sends message -> Backend retrieves Session via MikroORM.
3. **The Loop:**
    - **The Ear (Extraction):** Backend sends current field schema + user text to AI. AI returns JSON data.
    - **Validation:** Backend validates extracted JSON against Blueprint Schema.
    - **The Brain (Orchestrator):** Backend runs `determineNextStep` using JsonLogic. Updates `currentFieldId`.
    - **The Mouth (Generation):** Backend prompts AI to generate the next question (or error message).
4. **Response:** JSON payload `{ text: string, isComplete: boolean }` returned to Frontend.

## 5. Security & Compliance

- **Data Sovereignty:** Production environment targets EU-hosted LLMs (Scaleway).
- **Secrets Management:**
    - *Development:* `.env` files (gitignored).
    - *Production:* Cloud Environment Variables / Secrets Managers.
- **Input Sanitization:** All AI-extracted data is validated against the Schema before final persistence.

## 6. MVP Roadmap (Implemented Stories)

The following stories have been defined and/or implemented to validate the architecture:

- **Story 1: Project Scaffolding.**
    - Monorepo setup (NestJS + Vuetify).
- **Story 2: Database & Persistence.**
    - Dockerized PostgreSQL.
    - MikroORM setup with JSONB Session entity.
- **Story 3: The Blueprint.**
    - TypeScript Interfaces for Service Definitions.
    - Integration of `json-logic-js`.
- **Story 4: The Brain (Orchestrator).**
    - Deterministic State Machine implementation.
    - Logic for `determineNextStep`.
- **Story 5: AI Service.**
    - LangChain integration.
    - Configurable connection (OpenAI/Scaleway).
- **Story 6: The Ear (Extraction).**
    - Dynamic JSON Schema generation for LLM Structured Output.
- **Story 7: The Mouth (Generation).**
    - Dynamic Prompting for Questions, Errors, and Contextual FAQs.
- **Story 8: Frontend Layout.**
    - Vuetify Chat Layout implementation.
- **Story 9: The Coordinator.**
    - REST API (`POST /chat`).
    - Frontend Axios + Pinia integration.