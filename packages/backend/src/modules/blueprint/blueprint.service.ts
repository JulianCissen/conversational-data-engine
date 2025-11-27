import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  ServiceBlueprint,
  ServiceBlueprintSchema,
} from './interfaces/blueprint.interface';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Service for managing and loading Service Blueprints.
 * Blueprints define the conversational flow and data collection logic for each service.
 */
@Injectable()
export class BlueprintService implements OnModuleInit {
  private readonly logger = new Logger(BlueprintService.name);
  private readonly blueprintRegistry = new Map<string, ServiceBlueprint>();
  private readonly blueprintDataPath = path.join(__dirname, 'data');

  /**
   * Load all blueprints from the data directory on application startup.
   */
  async onModuleInit() {
    this.logger.log('Initializing BlueprintService...');
    await this.loadBlueprints();
    this.logger.log(
      `BlueprintService initialized with ${this.blueprintRegistry.size} blueprint(s).`,
    );
  }

  /**
   * Get all available blueprints.
   * @returns Array of all ServiceBlueprint objects
   */
  getAllBlueprints(): ServiceBlueprint[] {
    return Array.from(this.blueprintRegistry.values());
  }

  /**
   * Get a specific blueprint by ID.
   * @param id The unique identifier of the blueprint
   * @returns The ServiceBlueprint object
   * @throws Error if the blueprint is not found
   */
  getBlueprint(id: string): ServiceBlueprint {
    const blueprint = this.blueprintRegistry.get(id);
    if (!blueprint) {
      throw new Error(
        `Blueprint with id '${id}' not found. Available blueprints: ${this.getAllBlueprintIds().join(', ')}`,
      );
    }
    return blueprint;
  }

  /**
   * Check if a blueprint exists.
   * @param id The unique identifier of the blueprint
   * @returns True if the blueprint exists, false otherwise
   */
  hasBlueprint(id: string): boolean {
    return this.blueprintRegistry.has(id);
  }

  /**
   * Get all blueprint IDs currently loaded.
   * @returns Array of blueprint IDs
   */
  getAllBlueprintIds(): string[] {
    return Array.from(this.blueprintRegistry.keys());
  }

  /**
   * Load all blueprints from the data directory.
   * Scans for JSON files and validates them as ServiceBlueprint objects.
   */
  private async loadBlueprints() {
    this.blueprintRegistry.clear();

    const blueprintFiles = await this.getBlueprintFiles();
    if (blueprintFiles.length === 0) {
      return;
    }

    for (const file of blueprintFiles) {
      await this.loadBlueprintFromFile(file);
    }
  }

  /**
   * Get all blueprint JSON files from the data directory.
   * @returns Array of blueprint filenames, or empty array if directory doesn't exist
   */
  private async getBlueprintFiles(): Promise<string[]> {
    try {
      await fs.access(this.blueprintDataPath);
      const files = await fs.readdir(this.blueprintDataPath);
      return files.filter((file) => file.endsWith('.json'));
    } catch {
      this.logger.warn(
        `Blueprint data directory not found: ${this.blueprintDataPath}`,
      );
      return [];
    }
  }

  /**
   * Validate that a blueprint has all required properties using Zod schema.
   * @param blueprint The blueprint object to validate
   * @returns True if valid, false otherwise
   */
  private validateBlueprint(blueprint: unknown): blueprint is ServiceBlueprint {
    const result = ServiceBlueprintSchema.safeParse(blueprint);
    if (!result.success) {
      this.logger.debug(
        `Blueprint validation failed: ${JSON.stringify(result.error.issues)}`,
      );
    }
    return result.success;
  }

  /**
   * Load a single blueprint from a file.
   * @param filename The name of the file to load
   */
  private async loadBlueprintFromFile(filename: string): Promise<void> {
    try {
      const filePath = path.join(this.blueprintDataPath, filename);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const parsedData: unknown = JSON.parse(fileContent);

      if (!this.validateBlueprint(parsedData)) {
        this.logger.warn(
          `Invalid blueprint format in file: ${filename}. Skipping.`,
        );
        return;
      }

      this.blueprintRegistry.set(parsedData.id, parsedData);
      this.logger.debug(
        `Loaded blueprint: ${parsedData.id} (${parsedData.name})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to load blueprint from file: ${filename}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
