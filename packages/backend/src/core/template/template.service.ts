import { Injectable } from '@nestjs/common';
import * as Handlebars from 'handlebars';

/**
 * Service for handling template interpolation using Handlebars.
 * Provides a clean abstraction layer for string templating across the application.
 */
@Injectable()
export class TemplateService {
  /**
   * Compile and render a Handlebars template with the provided data.
   * @param template The template string with Handlebars syntax (e.g., "Hello {{name}}")
   * @param data The data object to interpolate into the template
   * @returns The rendered string with interpolated values
   */
  render(template: string, data: Record<string, any>): string {
    const compiledTemplate = Handlebars.compile(template);
    return compiledTemplate(data);
  }
}
