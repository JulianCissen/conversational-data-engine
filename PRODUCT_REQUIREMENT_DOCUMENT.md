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
- **Array Field Support:** Blueprint fields with `type: 'array'` are handled by the dedicated ArrayCollectionService via a Multi-Turn Conversational Collection loop (see §3.6).

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

### 3.6 Complex Input Types

#### Multi-Turn Conversational Collection

When a Blueprint field has `type: 'array'`, the engine delegates to the **ArrayCollectionService** instead of the standard single-field extraction path. The service drives a two-phase loop entirely through natural conversation:

- **COLLECTING phase:** The user is invited to provide one item at a time. For each user turn, `ArrayCollectionService` calls `InterpreterService.extractArrayItems()` to parse the user's message against the sub-field schema. Fully extracted items are appended to `accumulatedItems`. If an item is only partially provided (one or more sub-fields missing), the service stores it in `pendingPartialItem` and calls `PresenterService.generateSubFieldFollowUp()` to ask a targeted follow-up question for each missing sub-field — without switching phase. If nothing is extracted the opening question is re-asked.

- **CONFIRMING phase:** Once at least one complete item exists, the service transitions to CONFIRMING and calls `PresenterService.generateArrayConfirmationQuestion()` to ask the user whether they have finished or want to add another item. `InterpreterService.classifyArrayConfirmation()` classifies the response as `DONE` or `ADD_MORE`. On `ADD_MORE` the phase resets to COLLECTING while preserving `accumulatedItems`. On `DONE` the accumulated items are written to `conversation.data[fieldId]`, `arrayCollectionState` is cleared, and `ArrayCollectionService` returns a `FIELD_COMPLETE` sentinel to `ConversationFlowService` so the main orchestration loop can advance to the next field.

This design keeps the array-collection concern fully encapsulated in `ArrayCollectionService`. The frontend, controller DTO, and session completion detection require no changes.

## 4. Technical Architecture

### 4.1 Stack
- **Repository:** Monorepo (`packages/backend`, `packages/frontend`, `packages/blueprint-editor`, `packages/types`, `packages/ui-shared`).
- **Frontend:** Vue 3, TypeScript, Pinia, Axios, Vuetify.
- **Backend:** NestJS (Modular Architecture).
- **Database:** PostgreSQL (Dockerized).
- **ORM:** **MikroORM** (using JSONB columns for flexible session state).
- **Logic:** `json-logic-js`.
- **AI Layer:** `@langchain/openai` (Configurable for Scaleway/OpenAI/Ollama).
- **Shared Packages:**
    - `@conversational-data-engine/types`: Shared TypeScript/Zod type definitions for blueprints.
    - `@conversational-data-engine/ui-shared`: Shared Vuetify theme configuration and UI utilities.

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
- **Story 10: Blueprint Editor.**
    - Visual UI-based blueprint editor with Material Design 3.
    - Two-panel layout: Form editor (left) + Live JSON preview (right).
    - Components for metadata, fields, plugins, and hooks configuration.
    - Import/export functionality with Zod validation.
    - Template system for quick-start blueprints.
    - Shared packages for type safety and consistent theming.
- **Story 11: Complex Input Types (Multi-Turn Array Collection).**
    - `ArrayCollectionService` introduced to handle Blueprint fields of `type: 'array'`.
    - Implements the COLLECTING / CONFIRMING two-phase loop: extracts array items turn-by-turn via `InterpreterService.extractArrayItems()`, resolves partial items through targeted sub-field follow-ups, and confirms completion via `InterpreterService.classifyArrayConfirmation()`.
    - On confirmation, accumulated items are stored in `conversation.data[fieldId]` and `ArrayCollectionService` returns a `FIELD_COMPLETE` sentinel to `ConversationFlowService`.
    - `ConversationFlowService` routes any `type: 'array'` field turn through `ArrayCollectionService` with no changes to the frontend or controller DTOs.