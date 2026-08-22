import { describe, expect, it, vi } from 'vitest';

import type { CharacterCard } from '../cards/card-schema';
import {
  AGENT_FACT_PROVENANCES,
  AGENT_GAP_IMPACTS,
  AGENT_ORCHESTRATION_RECOVERIES,
  AGENT_PROGRESS_PHASES,
  AGENT_ROUTES,
  QUALITY_FINDING_EVIDENCE,
  QUALITY_FINDING_SEVERITIES,
} from './agent-orchestration-contracts';
import type {
  iCharacterBrief,
  iCharacterContentPlan,
  iProseJob,
  iQualityFinding,
} from './agent-orchestration-contracts';
import { createAgentOrchestrationService } from './agent-orchestration-service';
import type { iAgentOrchestrationInput } from './agent-orchestration-service';
import { createCharacterBriefService } from './character-brief-service';
import { createContentPlanService } from './content-plan-service';
import { FIELD_WRITING_STRATEGIES } from './field-writing-strategy';
import { createQualityGateService, MAX_QUALITY_REPAIR_PASSES } from './quality-gate-service';

const ZERO_USAGE = { inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0 };
const RUN_BUDGET = {
  maximumCalls: 20,
  maximumInputTokens: 100_000,
  maximumOutputTokens: 20_000,
  maximumCostUsd: 10,
  maximumLatencyMs: 120_000,
};

function createCard(): CharacterCard {
  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: 'Mira',
      description: '',
      personality: '',
      scenario: '',
      first_mes: '',
      mes_example: '',
      creator_notes: '',
      system_prompt: '',
      post_history_instructions: '',
      alternate_greetings: [],
      tags: [],
      creator: '',
      character_version: '',
      extensions: { custom_fields: [] },
    },
  };
}

function createBrief(fieldKeys: Array<'description' | 'personality'> = ['description']): iCharacterBrief {
  return {
    confirmedFacts: [
      {
        id: 'fact-1',
        statement: 'Mira is a guarded archivist.',
        provenance: AGENT_FACT_PROVENANCES.user,
        sourceId: null,
        impact: AGENT_GAP_IMPACTS.high,
        isReversibleDefault: false,
      },
    ],
    assumptions: [],
    creativeChoices: [],
    unresolvedQuestions: [],
    toneAndStyle: ['quiet tension'],
    boundaries: [],
    requiredMotifs: [],
    avoidedMotifs: [],
    fieldCoverage: fieldKeys.map((fieldKey) => ({ fieldKey, goals: [`Complete ${fieldKey}.`] })),
  };
}

function createPlan(fieldKeys: Array<'description' | 'personality'> = ['description']): iCharacterContentPlan {
  return {
    entries: fieldKeys.map((fieldKey, index) => ({
      fieldKey,
      purpose: `Purpose for ${fieldKey}.`,
      ownedFactIds: index === 0 ? ['fact-1'] : [],
      allowedEchoFactIds: [],
      forbiddenRestatements: [],
      relevantContext: [],
      requiredMacros: [],
      strictTemplate: null,
      depth: { minimumInformationUnits: 2, maximumOutputTokens: 300 },
      dependsOnFieldKeys: [],
    })),
    coupledFieldGroups: [],
    styleBible: ['Use concrete detail.'],
  };
}

function createJob(fieldKeys: Array<'description' | 'personality'> = ['description']): iProseJob {
  return {
    id: `prose-${fieldKeys.join('-')}`,
    fieldKeys,
    purposes: fieldKeys.map((fieldKey) => `Purpose for ${fieldKey}.`),
    ownedFacts: createBrief().confirmedFacts,
    allowedEchoes: [],
    forbiddenRestatements: [],
    relevantContext: [],
    styleBible: ['Use concrete detail.'],
    requiredMacros: [],
    strictTemplates: {},
    maximumOutputTokens: 600,
    dependsOnJobIds: [],
  };
}

function createFinding(ruleId: string, fieldKeys: Array<'description' | 'personality'>): iQualityFinding {
  return {
    ruleId,
    fieldKeys,
    severity: QUALITY_FINDING_SEVERITIES.warning,
    evidence: QUALITY_FINDING_EVIDENCE.specificity,
    explanation: 'The draft needs a more specific behavior.',
    repairInstruction: 'Add one concrete behavior without changing other fields.',
    isResolved: false,
  };
}

function createInput(): iAgentOrchestrationInput {
  return {
    runId: 'run-1',
    prompt: 'Make Mira a guarded archivist with dry humor and a precise physical presence.',
    card: createCard(),
    requestedFieldKeys: ['description'],
    referenceSummaries: [],
    toneAndStyle: [],
    boundaries: [],
    currentFields: { description: '' },
    strictTemplates: {},
    requiredMacros: {},
    fieldWritingStrategy: FIELD_WRITING_STRATEGIES['separate-fields'],
    writerBudget: RUN_BUDGET,
    qualityBudget: RUN_BUDGET,
  };
}

describe('character brief service', () => {
  it('uses the deterministic fast path for sufficient input', async () => {
    const enrichBrief = vi.fn();
    const service = createCharacterBriefService({ enrichBrief });
    const input = createInput();
    input.prompt =
      'A guarded archivist with dry humor, precise posture, ink-stained gloves, a fear of fire, and a habit of quietly cataloging exits during tense conversations.';

    const result = await service.createBrief(input);

    expect(result.isEnrichmentCallUsed).toBe(false);
    expect(result.brief.confirmedFacts[0]).toEqual(
      expect.objectContaining({ provenance: AGENT_FACT_PROVENANCES.user }),
    );
    expect(enrichBrief).not.toHaveBeenCalled();
  });

  it('enriches sparse input while rejecting high-impact invented assumptions', async () => {
    const validBrief = {
      ...createBrief(),
      confirmedFacts: createBrief().confirmedFacts.map((fact) => ({ ...fact, statement: 'Guarded archivist.' })),
      assumptions: [
        {
          id: 'assumption-1',
          statement: 'Keeps a reversible paper-catalog habit.',
          provenance: AGENT_FACT_PROVENANCES['model-assumption'],
          sourceId: null,
          impact: AGENT_GAP_IMPACTS.low,
          isReversibleDefault: true,
        },
      ],
    } satisfies iCharacterBrief;
    const service = createCharacterBriefService({ enrichBrief: vi.fn().mockResolvedValue(validBrief) });

    await expect(service.createBrief({ ...createInput(), prompt: 'Guarded archivist.' })).resolves.toEqual(
      expect.objectContaining({ isEnrichmentCallUsed: true }),
    );

    const invalidService = createCharacterBriefService({
      enrichBrief: vi.fn().mockResolvedValue({
        ...validBrief,
        assumptions: [{ ...validBrief.assumptions[0], impact: AGENT_GAP_IMPACTS.high }],
      }),
    });
    await expect(invalidService.createBrief({ ...createInput(), prompt: 'Guarded archivist.' })).rejects.toThrow(
      'High-impact model assumptions',
    );
  });
});

describe('content plan service', () => {
  it('allocates every fact once and builds separate tool-free prose jobs by default', async () => {
    const plan = {
      ...createPlan(['description', 'personality']),
      coupledFieldGroups: [['description', 'personality']],
    };
    const service = createContentPlanService({ planContent: vi.fn().mockResolvedValue(plan) });

    const result = await service.createPlan({
      brief: createBrief(['description', 'personality']),
      requestedFieldKeys: ['description', 'personality'],
      currentFields: {},
      strictTemplates: {},
      requiredMacros: {},
      fieldWritingStrategy: FIELD_WRITING_STRATEGIES['separate-fields'],
    });

    expect(result.jobs).toHaveLength(2);
    expect(result.jobs.map((job) => job.fieldKeys)).toEqual([['description'], ['personality']]);
    expect(result.jobs[0]).not.toHaveProperty('tools');
  });

  it('builds one combined prose job when requested', async () => {
    const service = createContentPlanService({
      planContent: vi.fn().mockResolvedValue(createPlan(['description', 'personality'])),
    });

    const result = await service.createPlan({
      brief: createBrief(['description', 'personality']),
      requestedFieldKeys: ['description', 'personality'],
      currentFields: {},
      strictTemplates: {},
      requiredMacros: {},
      fieldWritingStrategy: FIELD_WRITING_STRATEGIES['combined-fields'],
    });

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].fieldKeys).toEqual(['description', 'personality']);
  });

  it('rejects plans that omit primary fact ownership or change strict templates', async () => {
    const missingOwnership = createPlan();
    missingOwnership.entries[0].ownedFactIds = [];
    await expect(
      createContentPlanService({ planContent: vi.fn().mockResolvedValue(missingOwnership) }).createPlan({
        brief: createBrief(),
        requestedFieldKeys: ['description'],
        currentFields: {},
        strictTemplates: {},
        requiredMacros: {},
        fieldWritingStrategy: FIELD_WRITING_STRATEGIES['separate-fields'],
      }),
    ).rejects.toThrow('exactly one primary field');

    await expect(
      createContentPlanService({ planContent: vi.fn().mockResolvedValue(createPlan()) }).createPlan({
        brief: createBrief(),
        requestedFieldKeys: ['description'],
        currentFields: {},
        strictTemplates: { description: '**Identity:** {{gen:identity}}' },
        requiredMacros: {},
        fieldWritingStrategy: FIELD_WRITING_STRATEGIES['separate-fields'],
      }),
    ).rejects.toThrow('changed the strict template');
  });
});

describe('quality gate service', () => {
  it('runs deterministic checks before the critic and repairs only failing fields', async () => {
    const passingPersonality = 'Reserved in public, but she answers sincere questions with careful warmth.';
    const plan = createPlan(['description', 'personality']);
    plan.entries[0].requiredMacros = ['{{char}}'];
    const criticize = vi
      .fn()
      .mockImplementationOnce(async (_input, deterministicFindings) => {
        expect(deterministicFindings).not.toEqual([]);
        return Promise.resolve({ output: [], usage: ZERO_USAGE });
      })
      .mockResolvedValue({ output: [], usage: ZERO_USAGE });
    const repair = vi.fn().mockResolvedValue({
      output: {
        jobId: 'prose-description-personality',
        fields: {
          description: '{{char}} keeps ink-stained gloves tucked into a precise charcoal coat.',
          personality: 'This value must be ignored because personality passed review.',
        },
      },
      usage: ZERO_USAGE,
    });
    const service = createQualityGateService({ criticize, repair });
    const job = createJob(['description', 'personality']);
    const result = await service.review(
      {
        brief: createBrief(['description', 'personality']),
        plan,
        jobs: [job],
        drafts: {
          description: 'Mira keeps ink-stained gloves tucked into a precise charcoal coat.',
          personality: passingPersonality,
        },
        currentFields: {},
      },
      RUN_BUDGET,
    );

    expect(criticize).toHaveBeenCalled();
    expect(repair).toHaveBeenCalled();
    expect(result.drafts.personality).toBe(passingPersonality);
  });

  it('bounds targeted repairs to two passes and reports budget state', async () => {
    const criticize = vi
      .fn()
      .mockResolvedValueOnce({
        output: [
          createFinding('one', ['description']),
          createFinding('two', ['description']),
          createFinding('three', ['description']),
        ],
        usage: ZERO_USAGE,
      })
      .mockResolvedValueOnce({
        output: [createFinding('two', ['description']), createFinding('three', ['description'])],
        usage: ZERO_USAGE,
      })
      .mockResolvedValueOnce({ output: [createFinding('three', ['description'])], usage: ZERO_USAGE });
    const repair = vi
      .fn()
      .mockImplementation(async (job: iProseJob) =>
        Promise.resolve({ output: { jobId: job.id, fields: { description: 'Improved draft.' } }, usage: ZERO_USAGE }),
      );
    const result = await createQualityGateService({ criticize, repair }).review(
      {
        brief: createBrief(),
        plan: createPlan(),
        jobs: [createJob()],
        drafts: { description: 'Initial complete draft.' },
        currentFields: {},
      },
      RUN_BUDGET,
    );

    expect(repair).toHaveBeenCalledTimes(MAX_QUALITY_REPAIR_PASSES);
    expect(result.repairCount).toBe(MAX_QUALITY_REPAIR_PASSES);
    expect(result.findings).toHaveLength(1);
  });

  it('returns an explicit recoverable state when a targeted repair fails', async () => {
    const finding = createFinding('critic-finding', ['description']);
    const result = await createQualityGateService({
      criticize: vi.fn().mockResolvedValue({ output: [finding], usage: ZERO_USAGE }),
      repair: vi.fn().mockRejectedValue(new Error('repair unavailable')),
    }).review(
      {
        brief: createBrief(),
        plan: createPlan(),
        jobs: [createJob()],
        drafts: { description: 'A complete draft with a critic finding.' },
        currentFields: {},
      },
      RUN_BUDGET,
    );

    expect(result.isRepairAvailable).toBe(false);
    expect(result.findings).toEqual([finding]);
    expect(result.drafts.description).toBe('A complete draft with a critic finding.');
  });
});

describe('agent orchestration service', () => {
  function createDependencies() {
    const submitProposal = vi.fn().mockResolvedValue({ proposalId: 'proposal-1' });
    return {
      routeIntent: vi.fn().mockResolvedValue({
        output: { route: AGENT_ROUTES['focused-edit'], answer: null },
        usage: ZERO_USAGE,
      }),
      createBrief: vi.fn().mockResolvedValue({ brief: createBrief(), isEnrichmentCallUsed: false }),
      createPlan: vi.fn().mockResolvedValue({ plan: createPlan(), jobs: [createJob()] }),
      writeProse: vi.fn().mockResolvedValue({
        output: { jobId: 'prose-description', fields: { description: 'A complete focused description.' } },
        usage: ZERO_USAGE,
      }),
      reviewQuality: vi.fn().mockResolvedValue({
        drafts: { description: 'A complete focused description.' },
        findings: [],
        repairCount: 0,
        isCriticAvailable: true,
        isRepairAvailable: true,
        isBudgetExhausted: false,
      }),
      submitProposal,
    };
  }

  it('answers advice in one role call without invoking drafting or proposals', async () => {
    const dependencies = createDependencies();
    dependencies.routeIntent.mockResolvedValue({
      output: { route: AGENT_ROUTES.advice, answer: 'Use an actionable hook and preserve user agency.' },
      usage: ZERO_USAGE,
    });

    const result = await createAgentOrchestrationService(dependencies).run(createInput());

    expect(result).toEqual(
      expect.objectContaining({ route: AGENT_ROUTES.advice, phase: AGENT_PROGRESS_PHASES.completed, proposalId: null }),
    );
    expect(dependencies.routeIntent).toHaveBeenCalledTimes(1);
    expect(dependencies.createBrief).not.toHaveBeenCalled();
    expect(dependencies.submitProposal).not.toHaveBeenCalled();
  });

  it('keeps focused edits scoped and submits only after quality review', async () => {
    const dependencies = createDependencies();
    const phases: string[] = [];

    const result = await createAgentOrchestrationService(dependencies).run({
      ...createInput(),
      onPhaseChange: (phase) => phases.push(phase),
    });

    expect(result).toEqual(
      expect.objectContaining({
        route: AGENT_ROUTES['focused-edit'],
        phase: AGENT_PROGRESS_PHASES.completed,
        drafts: { description: 'A complete focused description.' },
        proposalId: 'proposal-1',
      }),
    );
    expect(dependencies.submitProposal).toHaveBeenCalledAfter(dependencies.reviewQuality);
    expect(phases).toEqual([
      AGENT_PROGRESS_PHASES.understanding,
      AGENT_PROGRESS_PHASES.planning,
      AGENT_PROGRESS_PHASES.drafting,
      AGENT_PROGRESS_PHASES.reviewing,
      AGENT_PROGRESS_PHASES.proposing,
      AGENT_PROGRESS_PHASES.completed,
    ]);
  });

  it('pauses for clarification and never creates a proposal', async () => {
    const dependencies = createDependencies();
    dependencies.createBrief.mockResolvedValue({
      brief: {
        ...createBrief(),
        unresolvedQuestions: [
          {
            id: 'question-1',
            question: 'Should the relationship be romantic or platonic?',
            impact: AGENT_GAP_IMPACTS.high,
            options: ['Romantic', 'Platonic'],
          },
        ],
      },
      isEnrichmentCallUsed: true,
    });

    const result = await createAgentOrchestrationService(dependencies).run(createInput());

    expect(result.recovery).toBe(AGENT_ORCHESTRATION_RECOVERIES['clarification-required']);
    expect(dependencies.createPlan).not.toHaveBeenCalled();
    expect(dependencies.submitProposal).not.toHaveBeenCalled();
  });

  it('does not create partial proposals when a prose job fails', async () => {
    const dependencies = createDependencies();
    dependencies.writeProse.mockRejectedValue(new Error('Writer unavailable.'));

    const result = await createAgentOrchestrationService(dependencies).run(createInput());

    expect(result.recovery).toBe(AGENT_ORCHESTRATION_RECOVERIES['partial-draft']);
    expect(dependencies.submitProposal).not.toHaveBeenCalled();
  });
});
