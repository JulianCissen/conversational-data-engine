import { Test, TestingModule } from '@nestjs/testing';
import { OrchestratorService } from './orchestrator.service';
import { ServiceBlueprint } from '../blueprint/interfaces/blueprint.interface';

describe('OrchestratorService', () => {
  let service: OrchestratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrchestratorService],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);
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
      const resultUndefined = service.determineNextStep(blueprint, dataUndefined);

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
              and: [{ '>': [{ var: 'age' }, 18] }, { '==': [{ var: 'country' }, 'NL'] }],
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
      const data = { transportType: 'train', trainClass: 'first', distance: 200 };
      const result = service.determineNextStep(blueprint, data);

      expect(result).toEqual({
        nextFieldId: null,
        isComplete: true,
      });
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
