import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LanguageConfig,
  loadAndValidateLanguageConfig,
} from './language.config';

/**
 * Service for managing global language configuration.
 * Provides default language settings that can be overridden at the blueprint level.
 */
@Injectable()
export class LanguageConfigService {
  private readonly config: LanguageConfig;

  /**
   * Initialize language configuration service with validated configuration.
   * @param configService - NestJS ConfigService instance
   */
  constructor(private readonly configService: ConfigService) {
    this.config = this.resolveConfig();
  }

  /**
   * Load configuration from environment variables and validate with Zod.
   * @returns Validated language configuration
   * @throws Error if configuration is invalid
   */
  private resolveConfig(): LanguageConfig {
    return loadAndValidateLanguageConfig(this.configService);
  }

  /**
   * Get the default language configuration for the application.
   * @returns Default language configuration
   */
  public getDefaultLanguageConfig(): LanguageConfig {
    return this.config;
  }
}
