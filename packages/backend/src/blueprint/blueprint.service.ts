import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ServiceBlueprint } from './interfaces/blueprint.interface';
import * as fs from 'fs';
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

    if (!fs.existsSync(this.blueprintDataPath)) {
      this.logger.warn(
        `Blueprint data directory not found: ${this.blueprintDataPath}`,
      );
      return;
    }

    const files = fs.readdirSync(this.blueprintDataPath);
    const jsonFiles = files.filter((file) => file.endsWith('.json'));

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(this.blueprintDataPath, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const blueprint: ServiceBlueprint = JSON.parse(fileContent);

        // Basic validation
        if (!blueprint.id || !blueprint.name || !blueprint.fields) {
          this.logger.warn(
            `Invalid blueprint format in file: ${file}. Skipping.`,
          );
          continue;
        }

        this.blueprintRegistry.set(blueprint.id, blueprint);
        this.logger.debug(`Loaded blueprint: ${blueprint.id} (${blueprint.name})`);
      } catch (error) {
        this.logger.error(
          `Failed to load blueprint from file: ${file}`,
          error.stack,
        );
      }
    }
  }
}
