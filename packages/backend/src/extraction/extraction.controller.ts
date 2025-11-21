import { Body, Controller, Post } from '@nestjs/common';
import { ExtractionService } from './extraction.service';
import { FieldDefinition } from '../blueprint/interfaces/blueprint.interface';

/**
 * DTO for extraction test endpoint
 */
class ExtractDataDto {
  message: string;
  fields: FieldDefinition[];
}

@Controller('extraction')
export class ExtractionController {
  constructor(private readonly extractionService: ExtractionService) {}

  /**
   * Test endpoint for data extraction
   * POST /extraction/test
   * 
   * @param dto - Contains the user message and field definitions
   * @returns Extracted structured data
   */
  @Post('test')
  async testExtraction(@Body() dto: ExtractDataDto): Promise<Record<string, any>> {
    return this.extractionService.extractData(dto.fields, dto.message);
  }
}
