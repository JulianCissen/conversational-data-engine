import { Entity, PrimaryKey, Property, JsonType } from '@mikro-orm/core';
import { BlueprintService } from '../blueprint/blueprint.service';
import { LlmMessage } from '../../core/llm/llm.types';

/**
 * Message stored in conversation history.
 * Extends LlmMessage with timestamp for persistence.
 */
export interface Message extends LlmMessage {
  timestamp: Date;
}

@Entity()
export class Conversation {
  // Static reference to BlueprintService for getter
  private static blueprintService: BlueprintService;

  static setBlueprintService(service: BlueprintService) {
    Conversation.blueprintService = service;
  }
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property()
  createdAt = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date();

  // This is where the flexible form data lives!
  @Property({ type: JsonType })
  data: Record<string, any> = {};

  @Property()
  status: 'COLLECTING' | 'COMPLETED' = 'COLLECTING';

  // Track which field the user is currently answering
  @Property({ nullable: true })
  currentFieldId?: string;

  // Track which blueprint (service) the user has selected
  @Property({ nullable: true })
  blueprintId?: string;

  // Track the detected/active language for this conversation (ISO code, e.g., 'en', 'de', 'fr')
  @Property({ nullable: true })
  currentLanguage?: string;

  // Store the complete message history
  @Property({ type: JsonType })
  messages: Message[] = [];

  // Getter to retrieve the blueprint name dynamically
  get blueprintName(): string | undefined {
    if (!this.blueprintId || !Conversation.blueprintService) {
      return undefined;
    }
    try {
      const blueprint = Conversation.blueprintService.getBlueprint(
        this.blueprintId,
      );
      return blueprint.name;
    } catch {
      return undefined;
    }
  }
}
