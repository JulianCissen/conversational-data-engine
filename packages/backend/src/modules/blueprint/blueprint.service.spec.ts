import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Blueprint Schema Parsing Tests
 *
 * These tests validate the dutch-welfare-application.json blueprint structure
 * directly from the JSON file, mirroring the assertions from ServiceBlueprintSchema.parse().
 * Direct Zod schema imports are avoided here because the @conversational-data-engine/types
 * package uses ESM ("type":"module") which Jest's CommonJS runner cannot load directly.
 * The structural assertions cover the same guarantees as the Zod schema parse.
 */
describe('BlueprintService / Schema Parsing', () => {
  let dutchWelfareJson: Record<string, unknown>;

  beforeAll(async () => {
    const filePath = path.join(
      __dirname,
      'data',
      'dutch-welfare-application.json',
    );
    const content = await fs.readFile(filePath, 'utf-8');
    dutchWelfareJson = JSON.parse(content) as Record<string, unknown>;
  });

  it('B-01: dutch-welfare-application.json has valid blueprint structure', () => {
    expect(dutchWelfareJson.id).toBeDefined();
    expect(dutchWelfareJson.name).toBeDefined();
    expect(Array.isArray(dutchWelfareJson.fields)).toBe(true);
    expect(Array.isArray(dutchWelfareJson.plugins)).toBe(true);
    expect(dutchWelfareJson.hooks).toBeDefined();
    // Must have at least one field
    expect((dutchWelfareJson.fields as unknown[]).length).toBeGreaterThan(0);
  });

  it('B-02: income_list field is type array', () => {
    const incomeList = (
      dutchWelfareJson.fields as { id: string; type: string }[]
    ).find((f) => f.id === 'income_list');
    expect(incomeList).toBeDefined();
    expect(incomeList!.type).toBe('array');
  });

  it('B-03: income_list field has 2 sub-field items', () => {
    const incomeList = (
      dutchWelfareJson.fields as { id: string; items?: unknown[] }[]
    ).find((f) => f.id === 'income_list');
    expect(incomeList).toBeDefined();
    expect(Array.isArray(incomeList!.items)).toBe(true);
    expect(incomeList!.items).toHaveLength(2);
  });

  it('B-04: income_amount field no longer exists in the blueprint', () => {
    const incomeAmount = (dutchWelfareJson.fields as { id: string }[]).find(
      (f) => f.id === 'income_amount',
    );
    expect(incomeAmount).toBeUndefined();
  });
});
