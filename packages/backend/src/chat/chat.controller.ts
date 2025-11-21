import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

export class ChatRequestDto {
  sessionId?: string;
  text: string;
}

export class ChatResponseDto {
  sessionId: string;
  text: string;
  isComplete: boolean;
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(@Body() body: ChatRequestDto): Promise<ChatResponseDto> {
    return await this.chatService.handleMessage(body.sessionId, body.text);
  }
}
