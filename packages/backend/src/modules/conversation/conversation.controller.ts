import { Controller, Post, Get, Delete, Body, Param } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationFlowService } from './conversation.flow.service';
import { Conversation } from './conversation.entity';

export class ConversationRequestDto {
  conversationId?: string;
  text: string;
}

export class ConversationResponseDto {
  conversationId: string;
  text: string;
  isComplete: boolean;
  data: Record<string, any>;
}

export interface ConversationDto {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  data: Record<string, any>;
  status: 'COLLECTING' | 'COMPLETED';
  currentFieldId?: string;
  blueprintId?: string;
  blueprintName?: string;
  messages: any[];
}

@Controller('conversation')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly conversationFlowService: ConversationFlowService,
  ) {}

  @Get('welcome-message')
  async getWelcomeMessage(): Promise<{ message: string }> {
    const message = await this.conversationService.getWelcomeMessage();
    return { message };
  }

  @Post()
  async handleMessage(
    @Body() body: ConversationRequestDto,
  ): Promise<ConversationResponseDto> {
    return await this.conversationFlowService.handleMessage(
      body.conversationId,
      body.text,
    );
  }

  @Get()
  async findAll(): Promise<ConversationDto[]> {
    const conversations = await this.conversationService.findAll();
    return conversations.map((c) => this.serializeConversation(c));
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ConversationDto> {
    const conversation = await this.conversationService.findOne(id);
    return this.serializeConversation(conversation);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return await this.conversationService.remove(id);
  }

  private serializeConversation(conversation: Conversation): ConversationDto {
    return {
      id: conversation.id,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      data: conversation.data,
      status: conversation.status,
      currentFieldId: conversation.currentFieldId,
      blueprintId: conversation.blueprintId,
      blueprintName: conversation.blueprintName, // This invokes the getter
      messages: conversation.messages,
    };
  }
}
