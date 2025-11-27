import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { Conversation } from './conversation.entity';
import { LlmMessage } from '../../core/llm/llm.types';
import { ServiceBlueprint } from '../blueprint/interfaces/blueprint.interface';
import { BlueprintService } from '../blueprint/blueprint.service';
import { WorkflowService } from '../workflow/workflow.service';

/**
 * ConversationService
 *
 * Manages conversation entities and their persistence.
 * Provides CRUD operations and helper methods for conversation data management.
 */
@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: EntityRepository<Conversation>,
    private readonly em: EntityManager,
    private readonly blueprintService: BlueprintService,
    private readonly workflowService: WorkflowService,
  ) {
    // Set the static BlueprintService reference for the entity getter
    Conversation.setBlueprintService(this.blueprintService);
  }

  /**
   * Load existing conversation or create a new one
   */
  async getOrCreateConversation(
    conversationId: string | undefined,
  ): Promise<Conversation> {
    if (conversationId) {
      const foundConversation = await this.conversationRepository.findOne({
        id: conversationId,
      });
      if (!foundConversation) {
        throw new Error('Conversation not found');
      }
      return foundConversation;
    }

    const conversation = new Conversation();
    await this.em.persistAndFlush(conversation);
    return conversation;
  }

  /**
   * Persist conversation changes to database
   */
  async persistConversation(): Promise<void> {
    await this.em.flush();
  }

  /**
   * Append a message to the conversation history
   */
  appendMessage(
    conversation: Conversation,
    role: 'user' | 'ai',
    content: string,
  ): void {
    conversation.messages.push({
      role,
      content,
      timestamp: new Date(),
    });
  }

  /**
   * Get conversation history as LlmMessage array.
   * @param conversation The conversation entity
   * @param limit Optional limit on number of messages to return (most recent first)
   * @returns Array of LlmMessages suitable for LLM context
   */
  getHistory(conversation: Conversation, limit?: number): LlmMessage[] {
    const messages = conversation.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    if (limit && limit > 0) {
      return messages.slice(-limit);
    }

    return messages;
  }

  /**
   * Validate conversation data against blueprint schema.
   * Throws an error if validation fails.
   */
  async validateConversationData(
    conversation: Conversation,
    blueprint: ServiceBlueprint,
  ): Promise<void> {
    for (const [key, value] of Object.entries(conversation.data)) {
      const field = blueprint.fields.find((f) => f.id === key);
      if (field) {
        const isValid = this.workflowService.validateValue(value, field);
        if (!isValid) {
          throw new Error(
            `Plugin slot update validation failed for field: ${key}`,
          );
        }
      }
    }
    return Promise.resolve();
  }

  /**
   * Get all conversations
   */
  async findAll(): Promise<Conversation[]> {
    return await this.conversationRepository.findAll({
      orderBy: { updatedAt: 'DESC' },
    });
  }

  /**
   * Get a single conversation by ID
   */
  async findOne(id: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({ id });
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    return conversation;
  }

  /**
   * Delete a conversation by ID
   */
  async remove(id: string): Promise<void> {
    const conversation = await this.conversationRepository.findOne({ id });
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    await this.em.removeAndFlush(conversation);
  }
}
