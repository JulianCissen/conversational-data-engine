import { Controller, Post, Get, Delete, Body, Param } from '@nestjs/common';
import { ConversationService } from './conversation.service';
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

export class ConversationConfigDto {
  welcomeMessage: string;
}

@Controller('conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get('config')
  async getConfig(): Promise<ConversationConfigDto> {
    return await this.conversationService.getConfig();
  }

  @Post()
  async handleMessage(@Body() body: ConversationRequestDto): Promise<ConversationResponseDto> {
    return await this.conversationService.handleMessage(body.conversationId, body.text);
  }

  @Get()
  async findAll(): Promise<Conversation[]> {
    return await this.conversationService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Conversation> {
    return await this.conversationService.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return await this.conversationService.remove(id);
  }
}
