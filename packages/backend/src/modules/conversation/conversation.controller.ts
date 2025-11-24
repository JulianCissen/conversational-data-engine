import { Controller, Post, Body } from '@nestjs/common';
import { ConversationService } from './conversation.service';

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

@Controller('conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  async handleMessage(@Body() body: ConversationRequestDto): Promise<ConversationResponseDto> {
    return await this.conversationService.handleMessage(body.conversationId, body.text);
  }
}
