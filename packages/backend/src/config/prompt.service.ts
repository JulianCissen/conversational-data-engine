import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { Prompt } from './prompt.entity';

/**
 * Service for managing AI prompts stored in the database.
 * Prompts are loaded into memory on startup and accessed as read-only.
 */
@Injectable()
export class PromptService implements OnModuleInit {
  private readonly logger = new Logger(PromptService.name);
  private readonly promptCache = new Map<string, string>();

  constructor(private readonly em: EntityManager) {}

  /**
   * Load all prompts from the database into memory on application startup.
   * If the database is empty, seed default prompts for development.
   */
  async onModuleInit() {
    this.logger.log('Initializing PromptService...');
    
    const fork = this.em.fork();
    const existingPrompts = await fork.find(Prompt, {});

    if (existingPrompts.length === 0) {
      this.logger.log('No prompts found in database. Seeding default prompts...');
      await this.seedDefaultPrompts(fork);
      
      // Reload prompts after seeding
      const seededPrompts = await fork.find(Prompt, {});
      this.loadPromptsIntoCache(seededPrompts);
    } else {
      this.logger.log(`Loading ${existingPrompts.length} prompts into memory...`);
      this.loadPromptsIntoCache(existingPrompts);
    }

    this.logger.log('PromptService initialized successfully.');
  }

  /**
   * Get a prompt by its key from the in-memory cache.
   * @param key The unique identifier for the prompt
   * @returns The prompt value
   * @throws Error if the prompt is not found in the cache
   */
  getPrompt(key: string): string {
    const prompt = this.promptCache.get(key);
    if (prompt === undefined) {
      throw new Error(`Prompt with key '${key}' not found. Available keys: ${this.getAllKeys().join(', ')}`);
    }
    return prompt;
  }

  /**
   * Check if a prompt exists in the cache.
   * @param key The unique identifier for the prompt
   * @returns True if the prompt exists, false otherwise
   */
  hasPrompt(key: string): boolean {
    return this.promptCache.has(key);
  }

  /**
   * Get all prompt keys currently loaded in memory.
   * @returns Array of prompt keys
   */
  getAllKeys(): string[] {
    return Array.from(this.promptCache.keys());
  }

  /**
   * Load prompts into the in-memory cache.
   * @param prompts Array of Prompt entities
   */
  private loadPromptsIntoCache(prompts: Prompt[]) {
    this.promptCache.clear();
    for (const prompt of prompts) {
      this.promptCache.set(prompt.key, prompt.value);
      this.logger.debug(`Loaded prompt: ${prompt.key}`);
    }
  }

  /**
   * Seed default prompts into the database for development environment.
   * These are the current hardcoded prompts from the existing services.
   * @param em EntityManager instance to use for seeding
   */
  private async seedDefaultPrompts(em: EntityManager) {
    const defaultPrompts = [
      {
        key: 'extraction.system',
        value:
          'You are a data extraction engine. Extract data from the user\'s message into the provided JSON format. ' +
          'Do not invent values. If a field is not mentioned, leave it out. ' +
          'Return only valid JSON matching the schema.',
      },
      {
        key: 'generation.question.system',
        value:
          'You are a helpful assistant collecting data for a form. Your goal is to ask the user for the specific information required. Be polite and concise.',
      },
      {
        key: 'generation.question.user',
        value:
          'Ask the user for the following field: \'{{questionTemplate}}\'. Context/Reason: \'{{aiContext}}\'.',
      },
      {
        key: 'generation.error.system',
        value:
          'You are a helpful assistant. The user tried to answer a question but provided invalid data. Explain the error gently and re-ask the question.',
      },
      {
        key: 'generation.error.user',
        value:
          'We asked for \'{{questionTemplate}}\'. The user replied: \'{{invalidInput}}\'. This is invalid because: \'{{errorReason}}\'. Please ask them to correct it.',
      },
      {
        key: 'generation.contextual.system',
        value:
          'You are a helpful assistant. The user has a question about the form. Answer their question based ONLY on the provided context, then politely re-ask the original form question. Do NOT repeat the user\'s question - instead, re-ask the field question from the form.',
      },
      {
        key: 'generation.contextual.user',
        value:
          'The current field is \'{{questionTemplate}}\'. The Context is: \'{{aiContext}}\'. The user asked: \'{{userQuestion}}\'. After answering, re-ask: \'{{questionTemplate}}\'.',
      },
    ];

    for (const promptData of defaultPrompts) {
      const prompt = new Prompt();
      prompt.key = promptData.key;
      prompt.value = promptData.value;
      em.persist(prompt);
      this.logger.debug(`Seeding prompt: ${promptData.key}`);
    }

    await em.flush();
    this.logger.log(`Seeded ${defaultPrompts.length} default prompts.`);
  }
}
