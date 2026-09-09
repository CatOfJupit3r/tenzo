import { describe, expect, it, vi } from 'vitest';

import {
  CHARACTER_CARD_SPECS,
  CHARACTER_CARD_SPEC_VERSIONS,
} from '@~/features/character-creator/lib/cards/card-file-enums';
import { CHARACTER_TEXT_FIELD_KEY } from '@~/features/character-creator/lib/cards/card-schema';

import type { CharacterCard, CharacterTextFieldKey } from '../cards/card-schema';
import type { iCharacterBrief, iCharacterContentPlan, iProseJob } from './agent-orchestration-contracts';
import {
  AGENT_FACT_PROVENANCES,
  AGENT_GAP_IMPACTS,
  AGENT_ORCHESTRATION_RECOVERIES,
  AGENT_PROGRESS_PHASES,
  AGENT_ROUTES,
  QUALITY_FINDING_SEVERITIES,
} from './agent-orchestration-contracts';
import type { iAgentOrchestrationInput } from './agent-orchestration-service';
import { createAgentOrchestrationService } from './agent-orchestration-service';
import { createCharacterBriefService } from './character-brief-service';
import { createContentPlanService } from './content-plan-service';
import { FIELD_WRITING_STRATEGIES } from './field-writing-strategy';
import { createQualityGateService } from './quality-gate-service';

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
    spec: CHARACTER_CARD_SPECS.CHARA_CARD_V2,
    spec_version: CHARACTER_CARD_SPEC_VERSIONS.VALUE_2_0,
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

function createBrief(fieldKeys: CharacterTextFieldKey[] = ['description']): iCharacterBrief {
  return {
    confirmedFacts: [
      {
        id: 'fact-1',
        statement: 'Mira is a guarded archivist.',
        provenance: AGENT_FACT_PROVENANCES.USER,
        sourceId: null,
        impact: AGENT_GAP_IMPACTS.HIGH,
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

function createPlan(fieldKeys: CharacterTextFieldKey[] = ['description']): iCharacterContentPlan {
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
    styleBible: ['Use concrete detail.'],
  };
}

function createJob(fieldKeys: CharacterTextFieldKey[] = ['description']): iProseJob {
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

function createInput(): iAgentOrchestrationInput {
  return {
    runId: 'run-1',
    prompt: 'Make Mira a guarded archivist with dry humor and a precise physical presence.',
    card: createCard(),
    requestedFieldKeys: [CHARACTER_TEXT_FIELD_KEY.DESCRIPTION],
    referenceSummaries: [],
    toneAndStyle: [],
    boundaries: [],
    currentFields: { description: '' },
    strictTemplates: {},
    requiredMacros: {},
    fieldWritingStrategy: FIELD_WRITING_STRATEGIES.SEPARATE_FIELDS,
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
      expect.objectContaining({ provenance: AGENT_FACT_PROVENANCES.USER }),
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
          provenance: AGENT_FACT_PROVENANCES.MODEL_ASSUMPTION,
          sourceId: null,
          impact: AGENT_GAP_IMPACTS.LOW,
          isReversibleDefault: true,
        },
      ],
    } satisfies iCharacterBrief;
    const service = createCharacterBriefService({ enrichBrief: vi.fn().mockResolvedValue(validBrief) });

    await expect(service.createBrief({ ...createInput(), prompt: 'Guarded archivist.' })).resolves.toEqual(
      expect.objectContaining({
        isEnrichmentCallUsed: true,
        brief: expect.objectContaining({
          confirmedFacts: expect.arrayContaining([
            expect.objectContaining({ id: 'user-prompt', statement: 'Guarded archivist.' }),
          ]),
        }),
      }),
    );

    const invalidService = createCharacterBriefService({
      enrichBrief: vi.fn().mockResolvedValue({
        ...validBrief,
        assumptions: [{ ...validBrief.assumptions[0], impact: AGENT_GAP_IMPACTS.HIGH }],
      }),
    });
    await expect(invalidService.createBrief({ ...createInput(), prompt: 'Guarded archivist.' })).rejects.toThrow(
      'High-impact model assumptions',
    );
  });
});

describe('content plan service', () => {
  it('allocates every fact once and builds separate tool-free prose jobs by default', async () => {
    const plan = createPlan(['description', 'personality']);
    const brief = createBrief(['description', 'personality']);
    brief.creativeChoices = [
      {
        id: 'identity',
        description: 'Her name is Ilyra Fen and she uses she/her pronouns.',
        impact: AGENT_GAP_IMPACTS.LOW,
        isSelected: true,
      },
    ];
    const service = createContentPlanService({ planContent: vi.fn().mockResolvedValue(plan) });

    const result = await service.createPlan({
      brief,
      requestedFieldKeys: [CHARACTER_TEXT_FIELD_KEY.DESCRIPTION, CHARACTER_TEXT_FIELD_KEY.PERSONALITY],
      currentFields: {},
      strictTemplates: {},
      promptTemplates: { personality: 'Personality(core traits; likes; dislikes; quirks)' },
      requiredMacros: {},
      fieldWritingStrategy: FIELD_WRITING_STRATEGIES.SEPARATE_FIELDS,
    });

    expect(result.jobs).toHaveLength(2);
    expect(result.jobs.map((job) => job.fieldKeys)).toEqual([['description'], ['personality']]);
    expect(
      result.jobs.every((job) =>
        job.relevantContext.includes('Canonical creative choice: Her name is Ilyra Fen and she uses she/her pronouns.'),
      ),
    ).toBe(true);
    expect(result.jobs[1].relevantContext).toContain(
      'Field template guidance:\nPersonality(core traits; likes; dislikes; quirks)',
    );
    expect(result.jobs[0]).not.toHaveProperty('tools');
  });

  it('builds one combined prose job when requested', async () => {
    const service = createContentPlanService({
      planContent: vi.fn().mockResolvedValue(createPlan(['description', 'personality'])),
    });

    const result = await service.createPlan({
      brief: createBrief(['description', 'personality']),
      requestedFieldKeys: [CHARACTER_TEXT_FIELD_KEY.DESCRIPTION, CHARACTER_TEXT_FIELD_KEY.PERSONALITY],
      currentFields: {},
      strictTemplates: {},
      requiredMacros: {},
      fieldWritingStrategy: FIELD_WRITING_STRATEGIES.COMBINED_FIELDS,
    });

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].fieldKeys).toEqual(['description', 'personality']);
  });

  it('keeps the global user prompt available without assigning it to multiple primary fields', async () => {
    const brief = createBrief(['description', 'personality']);
    brief.confirmedFacts[0].id = 'user-prompt';
    const plan = createPlan(['description', 'personality']);
    plan.entries[0].ownedFactIds = ['user-prompt'];
    plan.entries[1].ownedFactIds = ['user-prompt', 'invented-fact'];
    plan.entries[1].allowedEchoFactIds = ['invented-echo'];

    const result = await createContentPlanService({ planContent: vi.fn().mockResolvedValue(plan) }).createPlan({
      brief,
      requestedFieldKeys: [CHARACTER_TEXT_FIELD_KEY.DESCRIPTION, CHARACTER_TEXT_FIELD_KEY.PERSONALITY],
      currentFields: {},
      strictTemplates: {},
      requiredMacros: {},
      fieldWritingStrategy: FIELD_WRITING_STRATEGIES.SEPARATE_FIELDS,
    });

    expect(result.plan.entries[0].ownedFactIds).toEqual(['user-prompt']);
    expect(result.plan.entries[1].ownedFactIds).toEqual([]);
    expect(result.plan.entries[1].allowedEchoFactIds).toEqual(['user-prompt']);
    expect(result.jobs[1].allowedEchoes).toEqual([brief.confirmedFacts[0]]);
  });

  it('rejects plans that omit primary fact ownership', async () => {
    const missingOwnership = createPlan();
    missingOwnership.entries[0].ownedFactIds = [];
    await expect(
      createContentPlanService({ planContent: vi.fn().mockResolvedValue(missingOwnership) }).createPlan({
        brief: createBrief(),
        requestedFieldKeys: [CHARACTER_TEXT_FIELD_KEY.DESCRIPTION],
        currentFields: {},
        strictTemplates: {},
        requiredMacros: {},
        fieldWritingStrategy: FIELD_WRITING_STRATEGIES.SEPARATE_FIELDS,
      }),
    ).rejects.toThrow('exactly one primary field');
  });

  it('uses app-owned templates and macros instead of planner-authored constraints', async () => {
    const plan = createPlan(['description', 'personality']);
    plan.entries[0].strictTemplate = 'Planner replacement';
    plan.entries[0].requiredMacros = ['{{invented}}'];
    plan.entries[1].requiredMacros = ['{{also_invented}}'];

    const result = await createContentPlanService({ planContent: vi.fn().mockResolvedValue(plan) }).createPlan({
      brief: createBrief(['description', 'personality']),
      requestedFieldKeys: [CHARACTER_TEXT_FIELD_KEY.DESCRIPTION, CHARACTER_TEXT_FIELD_KEY.PERSONALITY],
      currentFields: {},
      strictTemplates: { description: '**Identity:** {{gen:identity}}' },
      requiredMacros: { description: ['{{char}}'] },
      fieldWritingStrategy: FIELD_WRITING_STRATEGIES.SEPARATE_FIELDS,
    });

    expect(result.plan.entries[0]).toMatchObject({
      strictTemplate: '**Identity:** {{gen:identity}}',
      requiredMacros: ['{{char}}'],
    });
    expect(result.plan.entries[1]).toMatchObject({ strictTemplate: null, requiredMacros: [] });
  });
});

describe('quality gate service', () => {
  it('repairs deterministic errors while leaving passing fields untouched', async () => {
    const passingPersonality = 'Reserved in public, but she answers sincere questions with careful warmth.';
    const plan = createPlan(['description', 'personality']);
    plan.entries[0].requiredMacros = ['{{char}}'];
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
    const service = createQualityGateService({ repair });
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

    expect(repair).toHaveBeenCalled();
    expect(result.drafts.personality).toBe(passingPersonality);
  });

  it('retains incremental deterministic repair progress across bounded passes', async () => {
    const plan = createPlan();
    plan.entries[0].requiredMacros = ['{{char}}', '{{user}}'];
    const repair = vi
      .fn()
      .mockResolvedValueOnce({
        output: { jobId: 'prose-description', fields: { description: '{{char}} improves the draft.' } },
        usage: ZERO_USAGE,
      })
      .mockResolvedValueOnce({
        output: {
          jobId: 'prose-description',
          fields: { description: '{{char}} improves the draft for {{user}}.' },
        },
        usage: ZERO_USAGE,
      });
    const result = await createQualityGateService({ repair }).review(
      {
        brief: createBrief(),
        plan,
        jobs: [createJob()],
        drafts: { description: 'Initial complete draft.' },
        currentFields: {},
      },
      RUN_BUDGET,
    );

    expect(repair).toHaveBeenCalledTimes(2);
    expect(result.repairCount).toBe(2);
    expect(result.findings.some((finding) => finding.severity === QUALITY_FINDING_SEVERITIES.ERROR)).toBe(false);
  });

  it('returns an explicit recoverable state when a targeted repair fails', async () => {
    const plan = createPlan();
    plan.entries[0].requiredMacros = ['{{char}}'];
    const result = await createQualityGateService({
      repair: vi.fn().mockRejectedValue(new Error('repair unavailable')),
    }).review(
      {
        brief: createBrief(),
        plan,
        jobs: [createJob()],
        drafts: { description: 'A complete draft missing its required macro.' },
        currentFields: {},
      },
      RUN_BUDGET,
    );

    expect(result.isRepairAvailable).toBe(false);
    expect(result.findings).not.toEqual([]);
    expect(result.drafts.description).toBe('A complete draft missing its required macro.');
  });
});

describe('agent orchestration service', () => {
  function createDependencies() {
    const submitProposal = vi.fn().mockResolvedValue({ proposalId: 'proposal-1' });
    return {
      routeIntent: vi.fn().mockResolvedValue({
        output: { route: AGENT_ROUTES.FOCUSED_EDIT, answer: null },
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
        isRepairAvailable: true,
        isBudgetExhausted: false,
      }),
      submitProposal,
    };
  }

  it('answers advice in one role call without invoking drafting or proposals', async () => {
    const dependencies = createDependencies();
    dependencies.routeIntent.mockResolvedValue({
      output: { route: AGENT_ROUTES.ADVICE, answer: 'Use an actionable hook and preserve user agency.' },
      usage: ZERO_USAGE,
    });

    const result = await createAgentOrchestrationService(dependencies).run(createInput());

    expect(result).toEqual(
      expect.objectContaining({ route: AGENT_ROUTES.ADVICE, phase: AGENT_PROGRESS_PHASES.COMPLETED, proposalId: null }),
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
        route: AGENT_ROUTES.FOCUSED_EDIT,
        phase: AGENT_PROGRESS_PHASES.COMPLETED,
        drafts: { description: 'A complete focused description.' },
        proposalId: 'proposal-1',
      }),
    );
    expect(dependencies.submitProposal).toHaveBeenCalledAfter(dependencies.reviewQuality);
    expect(phases).toEqual([
      AGENT_PROGRESS_PHASES.UNDERSTANDING,
      AGENT_PROGRESS_PHASES.PLANNING,
      AGENT_PROGRESS_PHASES.DRAFTING,
      AGENT_PROGRESS_PHASES.REVIEWING,
      AGENT_PROGRESS_PHASES.PROPOSING,
      AGENT_PROGRESS_PHASES.COMPLETED,
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
            impact: AGENT_GAP_IMPACTS.HIGH,
            options: ['Romantic', 'Platonic'],
          },
        ],
      },
      isEnrichmentCallUsed: true,
    });

    const result = await createAgentOrchestrationService(dependencies).run(createInput());

    expect(result.recovery).toBe(AGENT_ORCHESTRATION_RECOVERIES.CLARIFICATION_REQUIRED);
    expect(dependencies.createPlan).not.toHaveBeenCalled();
    expect(dependencies.submitProposal).not.toHaveBeenCalled();
  });

  it('does not create partial proposals when a prose job fails', async () => {
    const dependencies = createDependencies();
    dependencies.writeProse.mockRejectedValue(new Error('Writer unavailable.'));

    const result = await createAgentOrchestrationService(dependencies).run(createInput());

    expect(result.recovery).toBe(AGENT_ORCHESTRATION_RECOVERIES.PARTIAL_DRAFT);
    expect(result.answer).toContain('Writer unavailable.');
    expect(dependencies.submitProposal).not.toHaveBeenCalled();
  });
});
