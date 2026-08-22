import { describe, expect, it } from 'vitest';

import { AGENT_EVAL_FAILURE_CLASSES, AGENT_EVAL_ROUTES, AGENT_EVAL_RUBRIC_DIMENSIONS } from './agent-eval-contracts';
import { AGENT_EVAL_CORPUS } from './agent-eval-corpus';
import { AGENT_EVAL_FIELD_RUBRICS, AGENT_EVAL_SCORE_ANCHORS } from './agent-eval-rubric';

describe('agent eval foundation', () => {
  it('provides 30 unique versioned cases across every route and failure class', () => {
    expect(AGENT_EVAL_CORPUS).toHaveLength(30);
    expect(new Set(AGENT_EVAL_CORPUS.map((evalCase) => evalCase.id))).toHaveLength(30);

    const routes = new Set(AGENT_EVAL_CORPUS.map((evalCase) => evalCase.route));
    expect(routes).toEqual(new Set(Object.values(AGENT_EVAL_ROUTES)));

    const failureClasses = new Set(AGENT_EVAL_CORPUS.flatMap((evalCase) => evalCase.failureClasses));
    expect(failureClasses).toEqual(new Set(Object.values(AGENT_EVAL_FAILURE_CLASSES)));
    expect(AGENT_EVAL_CORPUS.some((evalCase) => evalCase.isMatureTheme)).toBe(true);
  });

  it('defines field-specific purposes and complete score anchors', () => {
    expect(AGENT_EVAL_FIELD_RUBRICS.description.purpose).not.toBe(AGENT_EVAL_FIELD_RUBRICS.personality.purpose);
    expect(AGENT_EVAL_FIELD_RUBRICS.scenario.emphasizedDimensions).toContain(
      AGENT_EVAL_RUBRIC_DIMENSIONS['roleplay-usability'],
    );
    expect(Object.keys(AGENT_EVAL_SCORE_ANCHORS)).toEqual(['1', '2', '3', '4', '5']);
  });
});
