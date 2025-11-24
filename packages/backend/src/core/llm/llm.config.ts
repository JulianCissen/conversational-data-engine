import { z } from 'zod';

/**
 * Zod schema for LLM configuration.
 * Validates all required environment variables for LLM setup.
 */
export const LlmConfigSchema = z.object({
  apiKey: z.string().min(1, 'LLM_API_KEY is required'),
  baseURL: z.string().url('LLM_BASE_URL must be a valid URL'),
  modelName: z.string().min(1, 'LLM_MODEL is required'),
  temperature: z.number().min(0).max(2).default(0),
});

/**
 * Type representing validated LLM configuration.
 */
export type LlmConfig = z.infer<typeof LlmConfigSchema>;
