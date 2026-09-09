import { em } from 'enumwaii';
import { z } from 'zod';

export const AGENT_GENERATION_BUDGET_ENUM = em({
  ECONOMY: 'economy',
  BALANCED: 'balanced',
  EXPANDED: 'expanded',
});
export const AGENT_GENERATION_BUDGETS = AGENT_GENERATION_BUDGET_ENUM.enum;
export const AGENT_GENERATION_BUDGET_SCHEMA = z.enum(AGENT_GENERATION_BUDGETS);

export type AgentGenerationBudget = z.infer<typeof AGENT_GENERATION_BUDGET_SCHEMA>;

export const AGENT_GENERATION_BUDGET_LABELS = AGENT_GENERATION_BUDGET_ENUM.derive<string>()(
  [AGENT_GENERATION_BUDGETS.ECONOMY, 'Economy'],
  [AGENT_GENERATION_BUDGETS.BALANCED, 'Balanced'],
  [AGENT_GENERATION_BUDGETS.EXPANDED, 'Expanded'],
);
