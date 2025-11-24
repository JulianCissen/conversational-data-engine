import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ServiceBlueprint } from './interfaces/blueprint.interface';
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
    } catch (error) {
      this.logger.warn(
        `Blueprint data directory not found: ${this.blueprintDataPath}`,
      );
      return [];
    }
  }

  /**
   * Validate that a blueprint has all required properties.
   * @param blueprint The blueprint object to validate
   * @returns True if valid, false otherwise
   */
  private validateBlueprint(blueprint: any): blueprint is ServiceBlueprint {
    return !!blueprint.id && !!blueprint.name && !!blueprint.fields;
  }

  /**
   * Load a single blueprint from a file.
   * @param filename The name of the file to load
   */
  private async loadBlueprintFromFile(filename: string): Promise<void> {
    try {
      const filePath = path.join(this.blueprintDataPath, filename);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const blueprint: ServiceBlueprint = JSON.parse(fileContent);

      if (!this.validateBlueprint(blueprint)) {
        this.logger.warn(
          `Invalid blueprint format in file: ${filename}. Skipping.`,
        );
        return;
      }

      this.blueprintRegistry.set(blueprint.id, blueprint);
      this.logger.debug(`Loaded blueprint: ${blueprint.id} (${blueprint.name})`);
    } catch (error) {
      this.logger.error(
        `Failed to load blueprint from file: ${filename}`,
        error.stack,
      );
    }
  }
}
