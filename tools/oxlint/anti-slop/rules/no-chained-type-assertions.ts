import { defineRule, type ESTree } from "@oxlint/plugins";

import { reportRuleViolation } from "../rule-helpers.ts";

const isTypeAssertionExpression = (node: ESTree.Node | null): boolean =>
  node?.type === "TSAsExpression" || node?.type === "TSTypeAssertion";

export const noChainedTypeAssertionsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Do not chain type assertions to fabricate evidence.",
    },
  },
  create(context) {
    return {
      TSAsExpression(node: ESTree.TSAsExpression) {
        if (isTypeAssertionExpression(node.expression)) {
          reportRuleViolation(
            context,
            node,
            "Do not chain type assertions; validate the value at its boundary.",
          );
        }
      },
      TSTypeAssertion(node: ESTree.TSTypeAssertion) {
        if (isTypeAssertionExpression(node.expression)) {
          reportRuleViolation(
            context,
            node,
            "Do not chain type assertions; validate the value at its boundary.",
          );
        }
      },
    };
  },
});
