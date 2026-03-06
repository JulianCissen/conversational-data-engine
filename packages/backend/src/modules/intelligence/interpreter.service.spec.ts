import { Test, TestingModule } from '@nestjs/testing';
import { InterpreterService } from './interpreter.service';
import { PromptExecutionService } from './prompt-execution.service';
import { PromptService } from '../../core/prompt/prompt.service';
import { ArrayFieldDefinition } from '../blueprint/interfaces/blueprint.interface';
import { LlmMessage } from '../../core/llm/llm.types';

// Mock the PromptExecutionService module to prevent loading LangChain's
// ESM-only transitive dependency (p-retry) in Jest's CommonJS environment.
jest.mock('./prompt-execution.service');

describe('InterpreterService', () => {
  let service: InterpreterService;
  let mockPromptExecutionService: { executeStructuredChat: jest.Mock };
  let mockPromptService: { getPrompt: jest.Mock };

  /** Shared array field fixture used across interpreter tests */
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
        validation: { type: 'number', maximum: 99999 },
      },
    ],
  };

  const history: LlmMessage[] = [{ role: 'user', content: 'Rent is 400' }];

  beforeEach(async () => {
    mockPromptExecutionService = {
      executeStructuredChat: jest.fn(),
    };
    mockPromptService = {
      getPrompt: jest.fn().mockReturnValue('system prompt'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterpreterService,
        {
          provide: PromptExecutionService,
          useValue: mockPromptExecutionService,
        },
        {
          provide: PromptService,
          useValue: mockPromptService,
        },
      ],
    }).compile();

    service = module.get<InterpreterService>(InterpreterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractData()', () => {
    it('I-01: array field produces array-type data in extraction result', async () => {
      mockPromptExecutionService.executeStructuredChat.mockResolvedValue({
        data: { income_list: [{ description: 'Rent', net_income: 400 }] },
      });

      const result = await service.extractData(
        [arrayField],
        undefined,
        history,
      );

      expect(Array.isArray(result.data.income_list)).toBe(true);
      expect(result.data.income_list).toEqual([
        { description: 'Rent', net_income: 400 },
      ]);
    });
  });

  describe('extractArrayItems()', () => {
    it('I-02: complete item extracted — returns values with no missingSubFields', async () => {
      mockPromptExecutionService.executeStructuredChat.mockResolvedValue({
        extracted_items: [{ description: 'Rent', net_income: 400 }],
      });

      const result = await service.extractArrayItems(
        arrayField,
        undefined,
        history,
      );

      expect(result).toEqual([
        {
          values: { description: 'Rent', net_income: 400 },
          missingSubFields: [],
        },
      ]);
    });

    it('I-03: partial item extracted — net_income missing from values and listed in missingSubFields', async () => {
      mockPromptExecutionService.executeStructuredChat.mockResolvedValue({
        extracted_items: [{ description: 'Rent', net_income: null }],
      });

      const result = await service.extractArrayItems(
        arrayField,
        undefined,
        history,
      );

      expect(result).toEqual([
        {
          values: { description: 'Rent' },
          missingSubFields: ['net_income'],
        },
      ]);
    });

    it('I-04: empty extraction returns []', async () => {
      mockPromptExecutionService.executeStructuredChat.mockResolvedValue({
        extracted_items: [],
      });

      const result = await service.extractArrayItems(
        arrayField,
        undefined,
        history,
      );

      expect(result).toEqual([]);
    });
  });

  describe('classifyArrayConfirmation()', () => {
    it('I-05: DONE response is returned as DONE', async () => {
      mockPromptExecutionService.executeStructuredChat.mockResolvedValue({
        confirmation: 'DONE',
      });

      const result = await service.classifyArrayConfirmation(
        arrayField,
        undefined,
        history,
      );

      expect(result).toBe('DONE');
    });

    it('I-06: ADD_MORE response is returned as ADD_MORE', async () => {
      mockPromptExecutionService.executeStructuredChat.mockResolvedValue({
        confirmation: 'ADD_MORE',
      });

      const result = await service.classifyArrayConfirmation(
        arrayField,
        undefined,
        history,
      );

      expect(result).toBe('ADD_MORE');
    });

    it('I-07: malformed LLM response defaults to ADD_MORE', async () => {
      mockPromptExecutionService.executeStructuredChat.mockResolvedValue({
        confirmation: 'UNKNOWN_VALUE',
      });

      const result = await service.classifyArrayConfirmation(
        arrayField,
        undefined,
        history,
      );

      expect(result).toBe('ADD_MORE');
    });
  });
});
