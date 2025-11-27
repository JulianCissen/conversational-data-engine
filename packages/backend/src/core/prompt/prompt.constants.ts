/**
 * Prompt keys used throughout the application.
 * These keys reference prompts stored in the database.
 */
export const PROMPT_KEYS = {
  // Interpreter prompts
  INTERPRETER_SYSTEM: 'interpreter.system',

  // Presenter prompts
  PRESENTER_QUESTION_SYSTEM: 'presenter.question.system',
  PRESENTER_QUESTION_USER: 'presenter.question.user',
  PRESENTER_ERROR_SYSTEM: 'presenter.error.system',
  PRESENTER_ERROR_USER: 'presenter.error.user',
  PRESENTER_CONTEXTUAL_SYSTEM: 'presenter.contextual.system',
  PRESENTER_CONTEXTUAL_USER: 'presenter.contextual.user',
  PRESENTER_LANGUAGE_ANNOUNCEMENT_SYSTEM:
    'presenter.language.announcement.system',
  PRESENTER_LANGUAGE_ANNOUNCEMENT_USER: 'presenter.language.announcement.user',

  // Intent classification prompts
  INTENT_CLASSIFICATION_SYSTEM: 'intent.classification.system',
  INTENT_CLASSIFICATION_USER: 'intent.classification.user',

  // Service selection prompts
  SERVICE_SELECTION_SYSTEM: 'service.selection.system',
  SERVICE_SELECTION_USER: 'service.selection.user',
} as const;

/**
 * Default prompt values for seeding the database.
 * These are used when the database is empty on first startup.
 */
export interface PromptDefinition {
  key: string;
  value: string;
}

export const DEFAULT_PROMPTS: PromptDefinition[] = [
  {
    key: PROMPT_KEYS.INTERPRETER_SYSTEM,
    value: `You are a data extraction engine. Extract data from the user's message into the provided JSON format. Do not invent values. If a field is not mentioned, leave it out. Return only valid JSON matching the schema.`,
  },
  {
    key: PROMPT_KEYS.PRESENTER_QUESTION_SYSTEM,
    value: `You are a helpful assistant collecting data for a form. Your goal is to ask the user for the specific information required. Be polite and concise.`,
  },
  {
    key: PROMPT_KEYS.PRESENTER_QUESTION_USER,
    value: `Ask the user for the following field: '{{questionTemplate}}'. Context/Reason: '{{aiContext}}'.`,
  },
  {
    key: PROMPT_KEYS.PRESENTER_ERROR_SYSTEM,
    value: `You are a helpful assistant. The user tried to answer a question but provided invalid data. Explain the error gently and re-ask the question.`,
  },
  {
    key: PROMPT_KEYS.PRESENTER_ERROR_USER,
    value: `We asked for '{{questionTemplate}}'. The user replied: '{{invalidInput}}'. This is invalid because: '{{errorReason}}'. Please ask them to correct it.`,
  },
  {
    key: PROMPT_KEYS.PRESENTER_CONTEXTUAL_SYSTEM,
    value: `You are a helpful assistant. The user has a question about the form. Answer their question based ONLY on the provided context, then politely re-ask the original form question. Do NOT repeat the user's question - instead, re-ask the field question from the form.`,
  },
  {
    key: PROMPT_KEYS.PRESENTER_CONTEXTUAL_USER,
    value: `The current field is '{{questionTemplate}}'. The Context is: '{{aiContext}}'. The user asked: '{{userQuestion}}'. After answering, re-ask: '{{questionTemplate}}'.`,
  },
  {
    key: PROMPT_KEYS.PRESENTER_LANGUAGE_ANNOUNCEMENT_SYSTEM,
    value: `You are a helpful assistant. Generate a brief, polite announcement message in the specified language.`,
  },
  {
    key: PROMPT_KEYS.PRESENTER_LANGUAGE_ANNOUNCEMENT_USER,
    value: `Please write a brief message (1-2 sentences) in the language with ISO code "{{languageCode}}" that informs the user that this entire service/form must be completed in that language only, and all communication must be in that language. Be polite and professional.`,
  },
  {
    key: PROMPT_KEYS.INTENT_CLASSIFICATION_SYSTEM,
    value: `You are an intent classifier for a conversational form system. Your task is to determine if the user is:
- ANSWER: Providing data/information to answer the current question
- QUESTION: Asking a clarifying question about the form, the field, or why information is needed

Respond with ONLY the word "ANSWER" or "QUESTION" - nothing else.`,
  },
  {
    key: PROMPT_KEYS.INTENT_CLASSIFICATION_USER,
    value: `Current field being collected: "{{questionTemplate}}"
Context: {{aiContext}}

User's message: "{{userText}}"

Is the user providing an ANSWER or asking a QUESTION?`,
  },
  {
    key: PROMPT_KEYS.SERVICE_SELECTION_SYSTEM,
    value: `You are a service matcher for a conversational form system. Your task is to determine which service the user wants to use based on their message.

Available services:
{{serviceList}}

If the user is asking what services are available, respond with: LIST_SERVICES
If the user clearly indicates a service, respond with ONLY the service ID (e.g., "travel_expense").
If unclear, respond with: UNCLEAR

Respond with ONLY one of: the service ID, "LIST_SERVICES", or "UNCLEAR" - nothing else.`,
  },
  {
    key: PROMPT_KEYS.SERVICE_SELECTION_USER,
    value: `User's message: "{{userText}}"

Which service does the user want?`,
  },
];
