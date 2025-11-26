import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { Prompt } from './prompt.entity';
import { DEFAULT_PROMPTS } from './prompt.constants';

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
    await this.ensurePromptsSeeded(fork);
    
    const prompts = await fork.find(Prompt, {});
    this.loadPromptsIntoCache(prompts);

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
   * Reload all prompts from the database into memory.
   * This can be used to refresh prompts after database updates.
   * @returns The number of prompts loaded
   */
  async reloadPrompts(): Promise<number> {
    this.logger.log('Reloading prompts from database...');
    
    const fork = this.em.fork();
    const prompts = await fork.find(Prompt, {});
    this.loadPromptsIntoCache(prompts);
    
    this.logger.log('Prompts reloaded successfully.');
    return prompts.length;
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
    this.logger.log(`Loaded ${prompts.length} prompts into memory.`);
  }

  /**
   * Ensure prompts are seeded if database is empty.
   * @param em EntityManager instance to use
   */
  private async ensurePromptsSeeded(em: EntityManager): Promise<void> {
    const existingPrompts = await em.find(Prompt, {});
    
    if (existingPrompts.length === 0) {
      this.logger.log('No prompts found in database. Seeding default prompts...');
      await this.seedDefaultPrompts(em);
    }
  }

  /**
   * Seed default prompts into the database for development environment.
   * These are the current hardcoded prompts from the existing services.
   * @param em EntityManager instance to use for seeding
   */
  private async seedDefaultPrompts(em: EntityManager) {
    for (const promptData of DEFAULT_PROMPTS) {
      const prompt = new Prompt();
      prompt.key = promptData.key;
      prompt.value = promptData.value;
      em.persist(prompt);
      this.logger.debug(`Seeding prompt: ${promptData.key}`);
    }

    await em.flush();
    this.logger.log(`Seeded ${DEFAULT_PROMPTS.length} default prompts.`);
  }
}
