import { Test, TestingModule } from '@nestjs/testing';
import { ArrayCollectionService } from './array-collection.service';
import { ConversationService } from './conversation.service';
import { InterpreterService } from '../intelligence/interpreter.service';
import { PresenterService } from '../intelligence/presenter.service';
import { ValidationService } from '../../core/validation/validation.service';
import { Conversation } from './conversation.entity';
import {
  ArrayFieldDefinition,
  ServiceBlueprint,
} from '../blueprint/interfaces/blueprint.interface';

const mockConversationService = {
  appendMessage: jest.fn(),
  persistConversation: jest.fn().mockResolvedValue(undefined),
  getHistory: jest.fn().mockReturnValue([]),
};
const mockInterpreter = {
  extractArrayItems: jest.fn(),
  classifyArrayConfirmation: jest.fn(),
  extractData: jest.fn(),
};
const mockPresenter = {
  generateQuestion: jest.fn().mockResolvedValue('Opening question?'),
  generateSubFieldFollowUp: jest.fn().mockResolvedValue('Follow-up question?'),
  generateArrayConfirmationQuestion: jest
    .fn()
    .mockResolvedValue('Are you done?'),
};
const mockValidation = {
  validateAgainstSchema: jest.fn().mockReturnValue(true),
  validateValue: jest.fn().mockReturnValue(true),
};

// Minimal ArrayFieldDefinition fixture
const incomeListField: ArrayFieldDefinition = {
  id: 'income_list',
  type: 'array',
  questionTemplate: 'List your income sources',
  aiContext: 'Collect income sources for the welfare application',
  items: [
    {
      id: 'description',
      type: 'string',
      questionTemplate: 'Description?',
      aiContext: 'Income source description',
      validation: {},
    },
    {
      id: 'net_income',
      type: 'number',
      questionTemplate: 'Amount?',
      aiContext: 'Monthly income amount',
      validation: { type: 'number', maximum: 99999 },
    },
  ],
  validation: { type: 'array', minItems: 1 },
};

// Minimal blueprint fixture
const blueprint: ServiceBlueprint = {
  id: 'test',
  name: 'Test Service',
  fields: [incomeListField],
  plugins: [],
  hooks: {},
};

// Helper to create a minimal Conversation object
function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    data: {},
    messages: [],
    status: 'COLLECTING',
    arrayCollectionState: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    blueprintId: 'test',
    currentFieldId: 'income_list',
    ...overrides,
  } as unknown as Conversation;
}

describe('ArrayCollectionService', () => {
  let service: ArrayCollectionService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Re-set default resolved values after clearAllMocks
    mockConversationService.persistConversation.mockResolvedValue(undefined);
    mockConversationService.getHistory.mockReturnValue([]);
    mockPresenter.generateQuestion.mockResolvedValue('Opening question?');
    mockPresenter.generateSubFieldFollowUp.mockResolvedValue(
      'Follow-up question?',
    );
    mockPresenter.generateArrayConfirmationQuestion.mockResolvedValue(
      'Are you done?',
    );
    mockValidation.validateAgainstSchema.mockReturnValue(true);
    mockValidation.validateValue.mockReturnValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArrayCollectionService,
        { provide: ConversationService, useValue: mockConversationService },
        { provide: InterpreterService, useValue: mockInterpreter },
        { provide: PresenterService, useValue: mockPresenter },
        { provide: ValidationService, useValue: mockValidation },
      ],
    }).compile();

    service = module.get<ArrayCollectionService>(ArrayCollectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('AC-01: Turn 1 initialises state and returns opening question', async () => {
    const conversation = makeConversation({ arrayCollectionState: null });

    const result = await service.handleArrayFieldTurn(
      conversation,
      blueprint,
      incomeListField,
    );

    expect(result.outcome).toBe('CONTINUE');
    expect(conversation.arrayCollectionState).not.toBeNull();
    expect(conversation.arrayCollectionState!.phase).toBe('COLLECTING');
    expect(conversation.arrayCollectionState!.accumulatedItems).toEqual([]);
    expect(conversation.arrayCollectionState!.pendingPartialItem).toBeNull();
    expect(conversation.arrayCollectionState!.fieldId).toBe('income_list');
    expect(mockPresenter.generateQuestion).toHaveBeenCalledWith(
      incomeListField,
      undefined,
      [],
    );
    expect(mockConversationService.appendMessage).toHaveBeenCalledTimes(1);
    expect(mockConversationService.persistConversation).toHaveBeenCalledTimes(
      1,
    );
  });

  it('AC-02: complete item extracted adds to accumulatedItems and transitions to CONFIRMING', async () => {
    mockInterpreter.extractArrayItems.mockResolvedValue([
      {
        values: { description: 'Rent', net_income: 400 },
        missingSubFields: [],
      },
    ]);

    const conversation = makeConversation({
      arrayCollectionState: {
        fieldId: 'income_list',
        phase: 'COLLECTING',
        accumulatedItems: [],
        pendingPartialItem: null,
        pendingMissingSubFields: [],
      },
    });

    const result = await service.handleArrayFieldTurn(
      conversation,
      blueprint,
      incomeListField,
    );

    expect(result.outcome).toBe('CONTINUE');
    expect(conversation.arrayCollectionState!.accumulatedItems).toHaveLength(1);
    expect(conversation.arrayCollectionState!.accumulatedItems[0]).toEqual({
      description: 'Rent',
      net_income: 400,
    });
    expect(conversation.arrayCollectionState!.phase).toBe('CONFIRMING');
    expect(mockPresenter.generateArrayConfirmationQuestion).toHaveBeenCalled();
    expect(mockConversationService.persistConversation).toHaveBeenCalledTimes(
      1,
    );
  });

  it('AC-04: partial item sets pendingPartialItem and asks follow-up', async () => {
    mockInterpreter.extractArrayItems.mockResolvedValue([
      { values: { description: 'Rent' }, missingSubFields: ['net_income'] },
    ]);

    const conversation = makeConversation({
      arrayCollectionState: {
        fieldId: 'income_list',
        phase: 'COLLECTING',
        accumulatedItems: [],
        pendingPartialItem: null,
        pendingMissingSubFields: [],
      },
    });

    const result = await service.handleArrayFieldTurn(
      conversation,
      blueprint,
      incomeListField,
    );

    expect(result.outcome).toBe('CONTINUE');
    expect(conversation.arrayCollectionState!.pendingPartialItem).toEqual({
      description: 'Rent',
    });
    expect(conversation.arrayCollectionState!.pendingMissingSubFields).toEqual([
      'net_income',
    ]);
    expect(mockPresenter.generateSubFieldFollowUp).toHaveBeenCalled();
    expect(mockConversationService.persistConversation).toHaveBeenCalledTimes(
      1,
    );
  });

  it('AC-05: resolving pending partial adds item and transitions to CONFIRMING', async () => {
    mockInterpreter.extractData.mockResolvedValue({
      data: { net_income: 400 },
    });

    const conversation = makeConversation({
      arrayCollectionState: {
        fieldId: 'income_list',
        phase: 'COLLECTING',
        accumulatedItems: [],
        pendingPartialItem: { description: 'Rent' },
        pendingMissingSubFields: ['net_income'],
      },
    });

    const result = await service.handleArrayFieldTurn(
      conversation,
      blueprint,
      incomeListField,
    );

    expect(result.outcome).toBe('CONTINUE');
    expect(conversation.arrayCollectionState!.pendingPartialItem).toBeNull();
    expect(conversation.arrayCollectionState!.pendingMissingSubFields).toEqual(
      [],
    );
    expect(conversation.arrayCollectionState!.accumulatedItems).toHaveLength(1);
    expect(conversation.arrayCollectionState!.accumulatedItems[0]).toEqual({
      description: 'Rent',
      net_income: 400,
    });
    expect(conversation.arrayCollectionState!.phase).toBe('CONFIRMING');
    expect(mockInterpreter.extractData).toHaveBeenCalledTimes(1);
    expect(mockConversationService.persistConversation).toHaveBeenCalledTimes(
      1,
    );
  });

  it('AC-07: empty extraction re-asks opening question without changing phase', async () => {
    mockInterpreter.extractArrayItems.mockResolvedValue([]);

    const conversation = makeConversation({
      arrayCollectionState: {
        fieldId: 'income_list',
        phase: 'COLLECTING',
        accumulatedItems: [],
        pendingPartialItem: null,
        pendingMissingSubFields: [],
      },
    });

    const result = await service.handleArrayFieldTurn(
      conversation,
      blueprint,
      incomeListField,
    );

    expect(result.outcome).toBe('CONTINUE');
    expect(conversation.arrayCollectionState!.phase).toBe('COLLECTING');
    expect(mockPresenter.generateQuestion).toHaveBeenCalled();
    expect(conversation.arrayCollectionState!.accumulatedItems).toHaveLength(0);
    expect(mockConversationService.persistConversation).toHaveBeenCalledTimes(
      1,
    );
  });

  it('AC-08: CONFIRMING+DONE returns FIELD_COMPLETE, stores data, clears state', async () => {
    mockInterpreter.classifyArrayConfirmation.mockResolvedValue('DONE');

    const accumulatedItems = [{ description: 'Rent', net_income: 400 }];
    const conversation = makeConversation({
      arrayCollectionState: {
        fieldId: 'income_list',
        phase: 'CONFIRMING',
        accumulatedItems,
        pendingPartialItem: null,
        pendingMissingSubFields: [],
      },
    });

    const result = await service.handleArrayFieldTurn(
      conversation,
      blueprint,
      incomeListField,
    );

    expect(result.outcome).toBe('FIELD_COMPLETE');
    expect(conversation.data['income_list']).toEqual(accumulatedItems);
    expect(conversation.arrayCollectionState).toBeNull();
    // persistConversation is the caller's (ConversationFlowService) responsibility on FIELD_COMPLETE
    expect(mockConversationService.persistConversation).not.toHaveBeenCalled();
    // FIELD_COMPLETE must NOT call appendMessage
    expect(mockConversationService.appendMessage).not.toHaveBeenCalled();
  });

  it('AC-09: CONFIRMING+ADD_MORE transitions back to COLLECTING, preserves items', async () => {
    mockInterpreter.classifyArrayConfirmation.mockResolvedValue('ADD_MORE');

    const accumulatedItems = [{ description: 'Rent', net_income: 400 }];
    const conversation = makeConversation({
      arrayCollectionState: {
        fieldId: 'income_list',
        phase: 'CONFIRMING',
        accumulatedItems: [...accumulatedItems],
        pendingPartialItem: null,
        pendingMissingSubFields: [],
      },
    });

    const result = await service.handleArrayFieldTurn(
      conversation,
      blueprint,
      incomeListField,
    );

    expect(result.outcome).toBe('CONTINUE');
    expect(conversation.arrayCollectionState!.phase).toBe('COLLECTING');
    expect(conversation.arrayCollectionState!.accumulatedItems).toHaveLength(1);
    expect(mockPresenter.generateQuestion).toHaveBeenCalled();
    expect(mockConversationService.persistConversation).toHaveBeenCalledTimes(
      1,
    );
  });

  it('AC-03: all extracted items fail per-item schema validation → re-asks, stays COLLECTING', async () => {
    mockInterpreter.extractArrayItems.mockResolvedValue([
      {
        values: { description: 'Rent', net_income: 200000 },
        missingSubFields: [],
      },
    ]);
    mockValidation.validateAgainstSchema.mockReturnValue(false);

    const conversation = makeConversation({
      arrayCollectionState: {
        fieldId: 'income_list',
        phase: 'COLLECTING',
        accumulatedItems: [],
        pendingPartialItem: null,
        pendingMissingSubFields: [],
      },
    });

    const result = await service.handleArrayFieldTurn(
      conversation,
      blueprint,
      incomeListField,
    );

    expect(result.outcome).toBe('CONTINUE');
    expect(conversation.arrayCollectionState!.phase).toBe('COLLECTING');
    expect(conversation.arrayCollectionState!.accumulatedItems).toHaveLength(0);
    expect(mockPresenter.generateQuestion).toHaveBeenCalledTimes(1);
    expect(mockConversationService.persistConversation).toHaveBeenCalledTimes(
      1,
    );
  });

  it('AC-06: resolved partial item fails per-item schema validation → discarded, transitions to CONFIRMING', async () => {
    mockInterpreter.extractData.mockResolvedValue({
      data: { net_income: 200000 },
    });
    mockValidation.validateAgainstSchema.mockReturnValue(false);

    const conversation = makeConversation({
      arrayCollectionState: {
        fieldId: 'income_list',
        phase: 'COLLECTING',
        accumulatedItems: [{ description: 'Previous', net_income: 300 }],
        pendingPartialItem: { description: 'Rent' },
        pendingMissingSubFields: ['net_income'],
      },
    });

    const result = await service.handleArrayFieldTurn(
      conversation,
      blueprint,
      incomeListField,
    );

    expect(result.outcome).toBe('CONTINUE');
    expect(conversation.arrayCollectionState!.pendingPartialItem).toBeNull();
    expect(conversation.arrayCollectionState!.pendingMissingSubFields).toEqual(
      [],
    );
    // Failed item was NOT added — only the pre-existing item remains
    expect(conversation.arrayCollectionState!.accumulatedItems).toHaveLength(1);
    expect(conversation.arrayCollectionState!.phase).toBe('CONFIRMING');
    expect(
      mockPresenter.generateArrayConfirmationQuestion,
    ).toHaveBeenCalledTimes(1);
    expect(mockConversationService.persistConversation).toHaveBeenCalledTimes(
      1,
    );
  });
});
