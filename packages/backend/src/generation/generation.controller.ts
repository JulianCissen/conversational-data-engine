import { Body, Controller, Post } from '@nestjs/common';
import { GenerationService } from './generation.service';
import { FieldDefinition } from '../blueprint/interfaces/blueprint.interface';

/**
 * DTO for testing the generation service
 */
class TestGenerationDto {
  /**
   * Type of generation to test: 'ask' | 'error' | 'context'
   */
  type: 'ask' | 'error' | 'context';

  /**
   * The field definition to use for generation
   */
  field: FieldDefinition;

  /**
   * Optional: The invalid input provided by the user (for 'error' type)
   */
  invalidInput?: string;

  /**
   * Optional: The reason why the input was invalid (for 'error' type)
   */
  errorReason?: string;

  /**
   * Optional: The user's question (for 'context' type)
   */
  userQuestion?: string;
}

@Controller('generation')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  /**
   * Test endpoint for generating different types of responses
   * @param dto Test generation parameters
   * @returns The generated string
   */
  @Post('test')
  async testGeneration(@Body() dto: TestGenerationDto): Promise<string> {
    switch (dto.type) {
      case 'ask':
        return await this.generationService.generateQuestion(dto.field);

      case 'error':
        if (!dto.invalidInput || !dto.errorReason) {
          throw new Error(
            'invalidInput and errorReason are required for error type',
          );
        }
        return await this.generationService.generateErrorResponse(
          dto.field,
          dto.invalidInput,
          dto.errorReason,
        );

      case 'context':
        if (!dto.userQuestion) {
          throw new Error('userQuestion is required for context type');
        }
        return await this.generationService.generateContextualResponse(
          dto.field,
          dto.userQuestion,
        );

      default:
        throw new Error(`Unknown generation type: ${dto.type}`);
    }
  }
}
