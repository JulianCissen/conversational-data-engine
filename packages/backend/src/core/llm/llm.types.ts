/**
 * LLM message role types aligned with LangChain JS message classes.
 * - 'system': Maps to SystemMessage
 * - 'user': Maps to HumanMessage
 * - 'ai': Maps to AIMessage
 */
export type LlmRole = 'system' | 'user' | 'ai';

/**
 * Unified message format for LLM interactions.
 * This is the single source of truth for message types across the application.
 */
export interface LlmMessage {
  role: LlmRole;
  content: string;
}
