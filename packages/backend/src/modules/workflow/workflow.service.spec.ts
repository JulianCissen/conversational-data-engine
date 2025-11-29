import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowService } from './workflow.service';
import { ServiceBlueprint } from '../blueprint/interfaces/blueprint.interface';
import { ValidationService } from '../../core/validation/validation.service';

describe('WorkflowService', () => {
  let service: WorkflowService;
  let mockValidationService: jest.Mocked<ValidationService>;

  beforeEach(async () => {
    mockValidationService = {
      validateValue: jest.fn().mockReturnValue(true),
      clearCache: jest.fn(),
    } as unknown as jest.Mocked<ValidationService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        { provide: ValidationService, useValue: mockValidationService },
      ],
    }).compile();

    service = module.get<WorkflowService>(WorkflowService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Linear Flow', () => {
    let blueprint: ServiceBlueprint;

    beforeEach(() => {
      blueprint = {
        id: 'linear-test',
        name: 'Linear Test Service',
        fields: [
          {
            id: 'fieldA',
            type: 'string',
            questionTemplate: 'What is Field A?',
            aiContext: 'Collect field A',
            validation: {},
          },
          {
            id: 'fieldB',
            type: 'string',
            questionTemplate: 'What is Field B?',
            aiContext: 'Collect field B',
            validation: {},
          },
        ],
        plugins: [],
        hooks: {},
      };
    });

    it('should return Field A when data is empty', () => {
      const data = {};
      const result = service.determineNextStep(blueprint, data);

      expect(result).toEqual({
        nextFieldId: 'fieldA',
        isComplete: false,
      });
    });

    it('should return Field B when Field A is answered', () => {
      const data = { fieldA: 'value for A' };
      const result = service.determineNextStep(blueprint, data);

      expect(result).toEqual({
        nextFieldId: 'fieldB',
        isComplete: false,
      });
    });

    it('should return complete when both fields are answered', () => {
      const data = { fieldA: 'value for A', fieldB: 'value for B' };
      const result = service.determineNextStep(blueprint, data);

      expect(result).toEqual({
        nextFieldId: null,
        isComplete: true,
      });
    });

    it('should treat null and undefined as unanswered', () => {
      const dataNull = { fieldA: null };
      const resultNull = service.determineNextStep(blueprint, dataNull);

      expect(resultNull).toEqual({
        nextFieldId: 'fieldA',
        isComplete: false,
      });

      const dataUndefined = { fieldA: undefined };
      const resultUndefined = service.determineNextStep(
        blueprint,
        dataUndefined,
      );

      expect(resultUndefined).toEqual({
        nextFieldId: 'fieldA',
        isComplete: false,
      });
    });

    it('should accept falsy values (0, false, empty string) as valid answers', () => {
      const dataZero = { fieldA: 0 };
      const resultZero = service.determineNextStep(blueprint, dataZero);

      expect(resultZero).toEqual({
        nextFieldId: 'fieldB',
        isComplete: false,
      });

      const dataFalse = { fieldA: false };
      const resultFalse = service.determineNextStep(blueprint, dataFalse);

      expect(resultFalse).toEqual({
        nextFieldId: 'fieldB',
        isComplete: false,
      });

      const dataEmpty = { fieldA: '' };
      const resultEmpty = service.determineNextStep(blueprint, dataEmpty);

      expect(resultEmpty).toEqual({
        nextFieldId: 'fieldB',
        isComplete: false,
      });
    });
  });

  describe('Conditional Logic - Simple Comparison', () => {
    let blueprint: ServiceBlueprint;

    beforeEach(() => {
      blueprint = {
        id: 'conditional-test',
        name: 'Conditional Test Service',
        fields: [
          {
            id: 'age',
            type: 'number',
            questionTemplate: 'What is your age?',
            aiContext: 'Collect user age',
            validation: {},
          },
          {
            id: 'driverLicense',
            type: 'string',
            questionTemplate: 'What is your driver license number?',
            aiContext: 'Collect driver license if age > 10',
            validation: {},
            condition: {
              '>': [{ var: 'age' }, 10],
            },
          },
        ],
        plugins: [],
        hooks: {},
      };
    });

    it('should skip conditional field when condition is false', () => {
      const data = { age: 5 };
      const result = service.determineNextStep(blueprint, data);

      expect(result).toEqual({
        nextFieldId: null,
        isComplete: true,
      });
    });

    it('should show conditional field when condition is true', () => {
      const data = { age: 15 };
      const result = service.determineNextStep(blueprint, data);

      expect(result).toEqual({
        nextFieldId: 'driverLicense',
        isComplete: false,
      });
    });

    it('should complete when conditional field is answered', () => {
      const data = { age: 15, driverLicense: 'DL12345' };
      const result = service.determineNextStep(blueprint, data);

      expect(result).toEqual({
        nextFieldId: null,
        isComplete: true,
      });
    });
  });

  describe('Complex Logic - AND Operator', () => {
    let blueprint: ServiceBlueprint;

    beforeEach(() => {
      blueprint = {
        id: 'complex-and-test',
        name: 'Complex AND Test Service',
        fields: [
          {
            id: 'age',
            type: 'number',
            questionTemplate: 'What is your age?',
            aiContext: 'Collect user age',
            validation: {},
          },
          {
            id: 'country',
            type: 'string',
            questionTemplate: 'What is your country?',
            aiContext: 'Collect user country',
            validation: {},
          },
          {
            id: 'specialOffer',
            type: 'string',
            questionTemplate: 'Would you like our special offer?',
            aiContext: 'Offer only for adults in NL',
            validation: {},
            condition: {
              and: [
                { '>': [{ var: 'age' }, 18] },
                { '==': [{ var: 'country' }, 'NL'] },
              ],
            },
          },
        ],
        plugins: [],
        hooks: {},
      };
    });

    it('should show field when both AND conditions are true', () => {
      const data = { age: 25, country: 'NL' };
      const result = service.determineNextStep(blueprint, data);

      expect(result).toEqual({
        nextFieldId: 'specialOffer',
        isComplete: false,
      });
    });

    it('should skip field when first AND condition is false', () => {
      const data = { age: 15, country: 'NL' };
      const result = service.determineNextStep(blueprint, data);

      expect(result).toEqual({
        nextFieldId: null,
        isComplete: true,
      });
    });

    it('should skip field when second AND condition is false', () => {
      const data = { age: 25, country: 'BE' };
      const result = service.determineNextStep(blueprint, data);

      expect(result).toEqual({
        nextFieldId: null,
        isComplete: true,
      });
    });
  });

  describe('Multiple Conditional Fields', () => {
    let blueprint: ServiceBlueprint;

    beforeEach(() => {
      blueprint = {
        id: 'multi-conditional-test',
        name: 'Multiple Conditional Fields Test',
        fields: [
          {
            id: 'transportType',
            type: 'string',
            questionTemplate: 'What type of transport?',
            aiContext: 'Collect transport type',
            validation: {},
          },
          {
            id: 'carMake',
            type: 'string',
            questionTemplate: 'What is the car make?',
            aiContext: 'Only if transport is car',
            validation: {},
            condition: {
              '==': [{ var: 'transportType' }, 'car'],
            },
          },
          {
            id: 'trainClass',
            type: 'string',
            questionTemplate: 'What train class?',
            aiContext: 'Only if transport is train',
            validation: {},
            condition: {
              '==': [{ var: 'transportType' }, 'train'],
            },
          },
          {
            id: 'distance',
            type: 'number',
            questionTemplate: 'What is the distance?',
            aiContext: 'Always ask for distance',
            validation: {},
          },
        ],
        plugins: [],
        hooks: {},
      };
    });

    it('should show car-specific field when transport is car', () => {
      const data = { transportType: 'car' };
      const result = service.determineNextStep(blueprint, data);

      expect(result).toEqual({
        nextFieldId: 'carMake',
        isComplete: false,
      });
    });

    it('should show train-specific field when transport is train', () => {
      const data = { transportType: 'train' };
      const result = service.determineNextStep(blueprint, data);

      expect(result).toEqual({
        nextFieldId: 'trainClass',
        isComplete: false,
      });
    });

    it('should skip both conditional fields and show distance for bike', () => {
      const data = { transportType: 'bike' };
      const result = service.determineNextStep(blueprint, data);

      expect(result).toEqual({
        nextFieldId: 'distance',
        isComplete: false,
      });
    });

    it('should complete car flow when all relevant fields are filled', () => {
      const data = { transportType: 'car', carMake: 'Toyota', distance: 100 };
      const result = service.determineNextStep(blueprint, data);

      expect(result).toEqual({
        nextFieldId: null,
        isComplete: true,
      });
    });

    it('should complete train flow when all relevant fields are filled', () => {
      const data = {
        transportType: 'train',
        trainClass: 'first',
        distance: 200,
      };
      const result = service.determineNextStep(blueprint, data);

      expect(result).toEqual({
        nextFieldId: null,
        isComplete: true,
      });
    });
  });

  describe('Field Satisfaction Edge Cases', () => {
    it('should handle field that becomes invisible after being answered', () => {
      const blueprint: ServiceBlueprint = {
        id: 'dynamic-visibility',
        name: 'Dynamic Visibility Service',
        fields: [
          {
            id: 'toggle',
            type: 'boolean',
            questionTemplate: 'Enable feature?',
            aiContext: 'Toggle feature',
            validation: {},
          },
          {
            id: 'featureDetail',
            type: 'string',
            questionTemplate: 'Feature details?',
            aiContext: 'Only shown when toggle is true',
            validation: {},
            condition: {
              '==': [{ var: 'toggle' }, true],
            },
          },
        ],
        plugins: [],
        hooks: {},
      };

      // First, toggle is true, so featureDetail should be visible
      const dataWithToggleTrue = { toggle: true };
      const resultTrue = service.determineNextStep(
        blueprint,
        dataWithToggleTrue,
      );
      expect(resultTrue).toEqual({
        nextFieldId: 'featureDetail',
        isComplete: false,
      });

      // Now toggle is false, even if featureDetail has a value, it's hidden
      const dataWithToggleFalse = {
        toggle: false,
        featureDetail: 'some value',
      };
      const resultFalse = service.determineNextStep(
        blueprint,
        dataWithToggleFalse,
      );
      expect(resultFalse).toEqual({
        nextFieldId: null,
        isComplete: true,
      });
    });

    it('should handle field visibility alternating based on data changes', () => {
      const blueprint: ServiceBlueprint = {
        id: 'alternating-visibility',
        name: 'Alternating Visibility Service',
        fields: [
          {
            id: 'userType',
            type: 'string',
            questionTemplate: 'Are you admin or user?',
            aiContext: 'User type',
            validation: {},
          },
          {
            id: 'adminCode',
            type: 'string',
            questionTemplate: 'Admin code?',
            aiContext: 'Only for admin',
            validation: {},
            condition: {
              '==': [{ var: 'userType' }, 'admin'],
            },
          },
          {
            id: 'userName',
            type: 'string',
            questionTemplate: 'User name?',
            aiContext: 'Only for regular user',
            validation: {},
            condition: {
              '==': [{ var: 'userType' }, 'user'],
            },
          },
        ],
        plugins: [],
        hooks: {},
      };

      // Admin path
      const adminData = { userType: 'admin' };
      const adminResult = service.determineNextStep(blueprint, adminData);
      expect(adminResult).toEqual({
        nextFieldId: 'adminCode',
        isComplete: false,
      });

      // User path
      const userData = { userType: 'user' };
      const userResult = service.determineNextStep(blueprint, userData);
      expect(userResult).toEqual({
        nextFieldId: 'userName',
        isComplete: false,
      });

      // Neither path (invalid type)
      const invalidData = { userType: 'guest' };
      const invalidResult = service.determineNextStep(blueprint, invalidData);
      expect(invalidResult).toEqual({
        nextFieldId: null,
        isComplete: true,
      });
    });
  });

  describe('Field Ordering Scenarios', () => {
    it('should handle blueprint with all conditional fields', () => {
      const blueprint: ServiceBlueprint = {
        id: 'all-conditional',
        name: 'All Conditional Service',
        fields: [
          {
            id: 'field1',
            type: 'string',
            questionTemplate: 'Field 1?',
            aiContext: 'Never visible',
            validation: {},
            condition: {
              '==': [{ var: 'trigger' }, 'show'],
            },
          },
          {
            id: 'field2',
            type: 'string',
            questionTemplate: 'Field 2?',
            aiContext: 'Also never visible',
            validation: {},
            condition: {
              '==': [{ var: 'trigger' }, 'show'],
            },
          },
        ],
        plugins: [],
        hooks: {},
      };

      // No trigger set, all fields hidden
      const result = service.determineNextStep(blueprint, {});
      expect(result).toEqual({
        nextFieldId: null,
        isComplete: true,
      });

      // Trigger set, fields become visible
      const resultWithTrigger = service.determineNextStep(blueprint, {
        trigger: 'show',
      });
      expect(resultWithTrigger).toEqual({
        nextFieldId: 'field1',
        isComplete: false,
      });
    });

    it('should handle interleaved conditional and unconditional fields', () => {
      const blueprint: ServiceBlueprint = {
        id: 'interleaved',
        name: 'Interleaved Service',
        fields: [
          {
            id: 'always1',
            type: 'string',
            questionTemplate: 'Always 1?',
            aiContext: 'Always shown',
            validation: {},
          },
          {
            id: 'conditional1',
            type: 'string',
            questionTemplate: 'Conditional 1?',
            aiContext: 'Sometimes shown',
            validation: {},
            condition: {
              '==': [{ var: 'showExtra' }, true],
            },
          },
          {
            id: 'always2',
            type: 'string',
            questionTemplate: 'Always 2?',
            aiContext: 'Always shown',
            validation: {},
          },
          {
            id: 'conditional2',
            type: 'string',
            questionTemplate: 'Conditional 2?',
            aiContext: 'Sometimes shown',
            validation: {},
            condition: {
              '==': [{ var: 'showExtra' }, true],
            },
          },
        ],
        plugins: [],
        hooks: {},
      };

      // Without extra fields
      const dataWithoutExtra = { always1: 'A', always2: 'B' };
      const resultWithout = service.determineNextStep(
        blueprint,
        dataWithoutExtra,
      );
      expect(resultWithout).toEqual({
        nextFieldId: null,
        isComplete: true,
      });

      // With extra fields enabled
      const dataWithExtra = { always1: 'A', showExtra: true };
      const resultWith = service.determineNextStep(blueprint, dataWithExtra);
      expect(resultWith).toEqual({
        nextFieldId: 'conditional1',
        isComplete: false,
      });
    });

    it('should handle conditional field that appears before its dependency', () => {
      const blueprint: ServiceBlueprint = {
        id: 'forward-reference',
        name: 'Forward Reference Service',
        fields: [
          {
            id: 'dependentField',
            type: 'string',
            questionTemplate: 'Dependent?',
            aiContext: 'Depends on later field',
            validation: {},
            condition: {
              '==': [{ var: 'trigger' }, 'yes'],
            },
          },
          {
            id: 'trigger',
            type: 'string',
            questionTemplate: 'Trigger?',
            aiContext: 'Controls earlier field',
            validation: {},
          },
        ],
        plugins: [],
        hooks: {},
      };

      // Trigger not set - dependent field hidden, trigger shown
      const result1 = service.determineNextStep(blueprint, {});
      expect(result1).toEqual({
        nextFieldId: 'trigger',
        isComplete: false,
      });

      // Trigger set to 'no' - dependent field still hidden
      const result2 = service.determineNextStep(blueprint, { trigger: 'no' });
      expect(result2).toEqual({
        nextFieldId: null,
        isComplete: true,
      });

      // Trigger set to 'yes' - dependent field shown
      const result3 = service.determineNextStep(blueprint, { trigger: 'yes' });
      expect(result3).toEqual({
        nextFieldId: 'dependentField',
        isComplete: false,
      });
    });
  });

  describe('Data Immutability', () => {
    it('should not mutate input data object', () => {
      const blueprint: ServiceBlueprint = {
        id: 'immutability-test',
        name: 'Immutability Test',
        fields: [
          {
            id: 'field1',
            type: 'string',
            questionTemplate: 'Field 1?',
            aiContext: 'First field',
            validation: {},
          },
        ],
        plugins: [],
        hooks: {},
      };

      const originalData = { existingField: 'value' };
      const dataCopy = { ...originalData };

      service.determineNextStep(blueprint, originalData);

      expect(originalData).toEqual(dataCopy);
      expect(Object.keys(originalData)).toEqual(Object.keys(dataCopy));
    });

    it('should not mutate blueprint object', () => {
      const blueprint: ServiceBlueprint = {
        id: 'immutability-test',
        name: 'Immutability Test',
        fields: [
          {
            id: 'field1',
            type: 'string',
            questionTemplate: 'Field 1?',
            aiContext: 'First field',
            validation: {},
          },
        ],
        plugins: [],
        hooks: {},
      };

      const blueprintCopy = JSON.parse(
        JSON.stringify(blueprint),
      ) as ServiceBlueprint;

      service.determineNextStep(blueprint, {});

      expect(blueprint).toEqual(blueprintCopy);
    });

    it('should return consistent results for same inputs (pure function)', () => {
      const blueprint: ServiceBlueprint = {
        id: 'pure-function-test',
        name: 'Pure Function Test',
        fields: [
          {
            id: 'field1',
            type: 'string',
            questionTemplate: 'Field 1?',
            aiContext: 'First field',
            validation: {},
          },
          {
            id: 'field2',
            type: 'string',
            questionTemplate: 'Field 2?',
            aiContext: 'Second field',
            validation: {},
            condition: {
              '==': [{ var: 'field1' }, 'trigger'],
            },
          },
        ],
        plugins: [],
        hooks: {},
      };

      const data = { field1: 'trigger' };

      const result1 = service.determineNextStep(blueprint, data);
      const result2 = service.determineNextStep(blueprint, data);
      const result3 = service.determineNextStep(blueprint, data);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
      expect(result1).toEqual({
        nextFieldId: 'field2',
        isComplete: false,
      });
    });
  });

  describe('isFieldVisible Edge Cases', () => {
    it('should handle truthy non-boolean values as visible', () => {
      const blueprint: ServiceBlueprint = {
        id: 'truthy-test',
        name: 'Truthy Test',
        fields: [
          {
            id: 'numberField',
            type: 'string',
            questionTemplate: 'Number field?',
            aiContext: 'Shown when var returns truthy number',
            validation: {},
            condition: {
              var: 'count',
            },
          },
        ],
        plugins: [],
        hooks: {},
      };

      // Non-zero number is truthy
      const result1 = service.determineNextStep(blueprint, { count: 5 });
      expect(result1).toEqual({
        nextFieldId: 'numberField',
        isComplete: false,
      });

      // String is truthy
      const result2 = service.determineNextStep(blueprint, { count: 'yes' });
      expect(result2).toEqual({
        nextFieldId: 'numberField',
        isComplete: false,
      });

      // Array is truthy
      const result3 = service.determineNextStep(blueprint, {
        count: [1, 2, 3],
      });
      expect(result3).toEqual({
        nextFieldId: 'numberField',
        isComplete: false,
      });

      // Object is truthy
      const result4 = service.determineNextStep(blueprint, {
        count: { key: 'value' },
      });
      expect(result4).toEqual({
        nextFieldId: 'numberField',
        isComplete: false,
      });
    });

    it('should handle falsy non-boolean values as invisible', () => {
      const blueprint: ServiceBlueprint = {
        id: 'falsy-test',
        name: 'Falsy Test',
        fields: [
          {
            id: 'field',
            type: 'string',
            questionTemplate: 'Field?',
            aiContext: 'Hidden when var returns falsy',
            validation: {},
            condition: {
              var: 'trigger',
            },
          },
        ],
        plugins: [],
        hooks: {},
      };

      // Zero is falsy
      const result1 = service.determineNextStep(blueprint, { trigger: 0 });
      expect(result1).toEqual({
        nextFieldId: null,
        isComplete: true,
      });

      // Empty string is falsy
      const result2 = service.determineNextStep(blueprint, { trigger: '' });
      expect(result2).toEqual({
        nextFieldId: null,
        isComplete: true,
      });

      // False is falsy
      const result3 = service.determineNextStep(blueprint, { trigger: false });
      expect(result3).toEqual({
        nextFieldId: null,
        isComplete: true,
      });

      // Null is falsy
      const result4 = service.determineNextStep(blueprint, { trigger: null });
      expect(result4).toEqual({
        nextFieldId: null,
        isComplete: true,
      });

      // Undefined is falsy
      const result5 = service.determineNextStep(blueprint, {
        trigger: undefined,
      });
      expect(result5).toEqual({
        nextFieldId: null,
        isComplete: true,
      });
    });

    it('should treat undefined condition as always visible', () => {
      const blueprint: ServiceBlueprint = {
        id: 'no-condition',
        name: 'No Condition',
        fields: [
          {
            id: 'field1',
            type: 'string',
            questionTemplate: 'Field 1?',
            aiContext: 'No condition',
            validation: {},
            condition: undefined,
          },
        ],
        plugins: [],
        hooks: {},
      };

      const result = service.determineNextStep(blueprint, {});
      expect(result).toEqual({
        nextFieldId: 'field1',
        isComplete: false,
      });
    });

    it('should treat missing condition property as always visible', () => {
      const blueprint: ServiceBlueprint = {
        id: 'missing-condition',
        name: 'Missing Condition',
        fields: [
          {
            id: 'field1',
            type: 'string',
            questionTemplate: 'Field 1?',
            aiContext: 'Missing condition property',
            validation: {},
            // Note: condition property is not present at all
          },
        ],
        plugins: [],
        hooks: {},
      };

      const result = service.determineNextStep(blueprint, {});
      expect(result).toEqual({
        nextFieldId: 'field1',
        isComplete: false,
      });
    });

    it('should treat null condition as falsy (field invisible)', () => {
      const blueprint: ServiceBlueprint = {
        id: 'null-condition',
        name: 'Null Condition',
        fields: [
          {
            id: 'field1',
            type: 'string',
            questionTemplate: 'Field 1?',
            aiContext: 'Null condition',
            validation: {},
            condition: null,
          },
        ],
        plugins: [],
        hooks: {},
      };

      const result = service.determineNextStep(blueprint, {});
      expect(result).toEqual({
        nextFieldId: null,
        isComplete: true,
      });
    });
  });

  describe('validateValue Delegation', () => {
    it('should delegate to ValidationService with correct parameters', () => {
      const field = {
        id: 'testField',
        type: 'string' as const,
        questionTemplate: 'Test?',
        aiContext: 'Test field',
        validation: { minLength: 5 },
      };
      const value = 'test value';

      const result = service.validateValue(value, field);

      expect(mockValidationService.validateValue.mock.calls[0]).toEqual([
        value,
        field,
      ]);
      expect(mockValidationService.validateValue.mock.calls.length).toBe(1);
      expect(result).toBe(true);
    });

    it('should return validation result from ValidationService', () => {
      const field = {
        id: 'testField',
        type: 'number' as const,
        questionTemplate: 'Test?',
        aiContext: 'Test field',
        validation: { min: 0 },
      };

      // Test valid case
      mockValidationService.validateValue.mockReturnValue(true);
      expect(service.validateValue(10, field)).toBe(true);

      // Test invalid case
      mockValidationService.validateValue.mockReturnValue(false);
      expect(service.validateValue(-5, field)).toBe(false);
    });

    it('should handle different value types', () => {
      const stringField = {
        id: 'string',
        type: 'string' as const,
        questionTemplate: 'String?',
        aiContext: 'String field',
        validation: {},
      };
      const numberField = {
        id: 'number',
        type: 'number' as const,
        questionTemplate: 'Number?',
        aiContext: 'Number field',
        validation: {},
      };
      const booleanField = {
        id: 'boolean',
        type: 'boolean' as const,
        questionTemplate: 'Boolean?',
        aiContext: 'Boolean field',
        validation: {},
      };
      const dateField = {
        id: 'date',
        type: 'date' as const,
        questionTemplate: 'Date?',
        aiContext: 'Date field',
        validation: {},
      };

      mockValidationService.validateValue.mockReturnValue(true);

      service.validateValue('text', stringField);
      service.validateValue(42, numberField);
      service.validateValue(true, booleanField);
      service.validateValue(new Date(), dateField);

      expect(mockValidationService.validateValue.mock.calls.length).toBe(4);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle partially filled data resuming mid-flow', () => {
      const blueprint: ServiceBlueprint = {
        id: 'resume-flow',
        name: 'Resume Flow Service',
        fields: [
          {
            id: 'step1',
            type: 'string',
            questionTemplate: 'Step 1?',
            aiContext: 'First step',
            validation: {},
          },
          {
            id: 'step2',
            type: 'string',
            questionTemplate: 'Step 2?',
            aiContext: 'Second step',
            validation: {},
          },
          {
            id: 'step3',
            type: 'string',
            questionTemplate: 'Step 3?',
            aiContext: 'Third step',
            validation: {},
          },
        ],
        plugins: [],
        hooks: {},
      };

      // Starting from scratch
      const result1 = service.determineNextStep(blueprint, {});
      expect(result1.nextFieldId).toBe('step1');

      // Resuming after step 1
      const result2 = service.determineNextStep(blueprint, { step1: 'done' });
      expect(result2.nextFieldId).toBe('step2');

      // Resuming after steps 1 and 2
      const result3 = service.determineNextStep(blueprint, {
        step1: 'done',
        step2: 'done',
      });
      expect(result3.nextFieldId).toBe('step3');

      // All steps complete
      const result4 = service.determineNextStep(blueprint, {
        step1: 'done',
        step2: 'done',
        step3: 'done',
      });
      expect(result4).toEqual({
        nextFieldId: null,
        isComplete: true,
      });
    });

    it('should skip multiple consecutive conditional fields', () => {
      const blueprint: ServiceBlueprint = {
        id: 'skip-multiple',
        name: 'Skip Multiple Service',
        fields: [
          {
            id: 'trigger',
            type: 'string',
            questionTemplate: 'Trigger?',
            aiContext: 'Controls multiple fields',
            validation: {},
          },
          {
            id: 'conditional1',
            type: 'string',
            questionTemplate: 'Conditional 1?',
            aiContext: 'Only if trigger is active',
            validation: {},
            condition: {
              '==': [{ var: 'trigger' }, 'active'],
            },
          },
          {
            id: 'conditional2',
            type: 'string',
            questionTemplate: 'Conditional 2?',
            aiContext: 'Only if trigger is active',
            validation: {},
            condition: {
              '==': [{ var: 'trigger' }, 'active'],
            },
          },
          {
            id: 'conditional3',
            type: 'string',
            questionTemplate: 'Conditional 3?',
            aiContext: 'Only if trigger is active',
            validation: {},
            condition: {
              '==': [{ var: 'trigger' }, 'active'],
            },
          },
          {
            id: 'finalField',
            type: 'string',
            questionTemplate: 'Final?',
            aiContext: 'Always shown',
            validation: {},
          },
        ],
        plugins: [],
        hooks: {},
      };

      // All conditionals hidden, skip to finalField
      const result = service.determineNextStep(blueprint, {
        trigger: 'inactive',
      });
      expect(result).toEqual({
        nextFieldId: 'finalField',
        isComplete: false,
      });
    });

    it('should handle complex field dependency chains', () => {
      const blueprint: ServiceBlueprint = {
        id: 'dependency-chain',
        name: 'Dependency Chain Service',
        fields: [
          {
            id: 'hasVehicle',
            type: 'boolean',
            questionTemplate: 'Do you have a vehicle?',
            aiContext: 'Vehicle ownership',
            validation: {},
          },
          {
            id: 'vehicleType',
            type: 'string',
            questionTemplate: 'What type of vehicle?',
            aiContext: 'Only if has vehicle',
            validation: {},
            condition: {
              '==': [{ var: 'hasVehicle' }, true],
            },
          },
          {
            id: 'carBrand',
            type: 'string',
            questionTemplate: 'What car brand?',
            aiContext: 'Only if vehicle is car',
            validation: {},
            condition: {
              and: [
                { '==': [{ var: 'hasVehicle' }, true] },
                { '==': [{ var: 'vehicleType' }, 'car'] },
              ],
            },
          },
          {
            id: 'motorcycleBrand',
            type: 'string',
            questionTemplate: 'What motorcycle brand?',
            aiContext: 'Only if vehicle is motorcycle',
            validation: {},
            condition: {
              and: [
                { '==': [{ var: 'hasVehicle' }, true] },
                { '==': [{ var: 'vehicleType' }, 'motorcycle'] },
              ],
            },
          },
          {
            id: 'registrationYear',
            type: 'number',
            questionTemplate: 'Registration year?',
            aiContext: 'Only if has vehicle',
            validation: {},
            condition: {
              '==': [{ var: 'hasVehicle' }, true],
            },
          },
        ],
        plugins: [],
        hooks: {},
      };

      // No vehicle - skip all
      const result1 = service.determineNextStep(blueprint, {
        hasVehicle: false,
      });
      expect(result1).toEqual({
        nextFieldId: null,
        isComplete: true,
      });

      // Has vehicle, type is car
      const result2 = service.determineNextStep(blueprint, {
        hasVehicle: true,
        vehicleType: 'car',
      });
      expect(result2.nextFieldId).toBe('carBrand');

      // Has vehicle, car brand filled, should skip motorcycle and ask registration
      const result3 = service.determineNextStep(blueprint, {
        hasVehicle: true,
        vehicleType: 'car',
        carBrand: 'Toyota',
      });
      expect(result3.nextFieldId).toBe('registrationYear');

      // Has vehicle, type is motorcycle
      const result4 = service.determineNextStep(blueprint, {
        hasVehicle: true,
        vehicleType: 'motorcycle',
      });
      expect(result4.nextFieldId).toBe('motorcycleBrand');
    });

    it('should handle large blueprint with many fields efficiently', () => {
      // Create a blueprint with 50 fields
      const fields = Array.from({ length: 50 }, (_, i) => ({
        id: `field${i}`,
        type: 'string' as const,
        questionTemplate: `Field ${i}?`,
        aiContext: `Field ${i}`,
        validation: {},
      }));

      const blueprint: ServiceBlueprint = {
        id: 'large-blueprint',
        name: 'Large Blueprint',
        fields,
        plugins: [],
        hooks: {},
      };

      // Should find first unanswered field efficiently
      const partialData = Object.fromEntries(
        Array.from({ length: 25 }, (_, i) => [`field${i}`, `value${i}`]),
      );

      const startTime = Date.now();
      const result = service.determineNextStep(blueprint, partialData);
      const endTime = Date.now();

      expect(result.nextFieldId).toBe('field25');
      expect(result.isComplete).toBe(false);
      // Should complete in reasonable time (less than 100ms for 50 fields)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty blueprint', () => {
      const blueprint: ServiceBlueprint = {
        id: 'empty',
        name: 'Empty Service',
        fields: [],
        plugins: [],
        hooks: {},
      };

      const result = service.determineNextStep(blueprint, {});

      expect(result).toEqual({
        nextFieldId: null,
        isComplete: true,
      });
    });

    it('should handle condition referencing missing data', () => {
      const blueprint: ServiceBlueprint = {
        id: 'missing-var',
        name: 'Missing Variable Service',
        fields: [
          {
            id: 'field1',
            type: 'string',
            questionTemplate: 'Field 1',
            aiContext: 'Context 1',
            validation: {},
            condition: { var: 'nonExistentField' },
          },
        ],
        plugins: [],
        hooks: {},
      };

      const result = service.determineNextStep(blueprint, {});

      // JsonLogic returns null/undefined for missing vars, which is falsy
      expect(result).toEqual({
        nextFieldId: null,
        isComplete: true,
      });
    });
  });
});
