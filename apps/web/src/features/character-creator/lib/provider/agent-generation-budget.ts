import { z } from 'zod';

export const AGENT_GENERATION_BUDGET_SCHEMA = z.enum(['economy', 'balanced', 'expanded']);
export const AGENT_GENERATION_BUDGETS = AGENT_GENERATION_BUDGET_SCHEMA.enum;
export type AgentGenerationBudget = z.infer<typeof AGENT_GENERATION_BUDGET_SCHEMA>;

export const AGENT_GENERATION_BUDGET_LABELS = {
  [AGENT_GENERATION_BUDGETS.economy]: 'Economy',
  [AGENT_GENERATION_BUDGETS.balanced]: 'Balanced',
  [AGENT_GENERATION_BUDGETS.expanded]: 'Expanded',
} satisfies Record<AgentGenerationBudget, string>;
