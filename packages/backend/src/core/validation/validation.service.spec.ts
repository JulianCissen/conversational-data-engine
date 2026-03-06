import { Test, TestingModule } from '@nestjs/testing';
import { ValidationService } from './validation.service';
import { ArrayFieldDefinition } from '../../modules/blueprint/interfaces/blueprint.interface';

describe('ValidationService', () => {
  let service: ValidationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidationService],
    }).compile();

    service = module.get<ValidationService>(ValidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateValue() with array schema', () => {
    const arrayField: ArrayFieldDefinition = {
      id: 'income_list',
      type: 'array',
      questionTemplate: 'List your income sources',
      aiContext: 'Collect income sources',
      validation: { type: 'array', minItems: 1 },
      items: [
        {
          id: 'description',
          type: 'string',
          questionTemplate: 'Description?',
          aiContext: 'Description of income source',
          validation: {},
        },
        {
          id: 'net_income',
          type: 'number',
          questionTemplate: 'Amount?',
          aiContext: 'Net income amount',
          validation: {},
        },
      ],
    };

    it('V-01: valid array with one item passes validation', () => {
      const value = [{ description: 'Rent', net_income: 400 }];
      const result = service.validateValue(value, arrayField);
      expect(result).toBe(true);
    });

    it('V-02: empty array fails validation when minItems is 1', () => {
      const value: unknown[] = [];
      const result = service.validateValue(value, arrayField);
      expect(result).toBe(false);
    });

    it('V-03: array with 2 items passes validation with minItems:1, maxItems:3', () => {
      const boundedField: ArrayFieldDefinition = {
        ...arrayField,
        validation: { type: 'array', minItems: 1, maxItems: 3 },
      };
      const value = [
        { description: 'Rent', net_income: 400 },
        { description: 'Job', net_income: 1200 },
      ];
      const result = service.validateValue(value, boundedField);
      expect(result).toBe(true);
    });
  });

  describe('validateAgainstSchema()', () => {
    const objectSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        amount: { type: 'number' },
      },
      required: ['name', 'amount'],
    };

    it('V-04: valid object passes schema validation', () => {
      const value = { name: 'Rent', amount: 400 };
      const result = service.validateAgainstSchema(value, objectSchema);
      expect(result).toBe(true);
    });

    it('V-05: missing required field fails schema validation', () => {
      const value = { name: 'Rent' };
      const result = service.validateAgainstSchema(value, objectSchema);
      expect(result).toBe(false);
    });

    it('V-06: wrong type fails schema validation', () => {
      const value = { name: 'Rent', amount: 'not-a-number' };
      const result = service.validateAgainstSchema(value, objectSchema);
      expect(result).toBe(false);
    });
  });
});
