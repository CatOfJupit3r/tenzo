import { defineRule, type ESTree } from "@oxlint/plugins";

import { isMemberNamed, reportRuleViolation } from "../rule-helpers.ts";

export const noModuleMockingRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Prefer explicit dependency seams over module mocks.",
    },
  },
  create(context) {
    return {
      CallExpression(node: ESTree.CallExpression) {
        if (
          isMemberNamed(node.callee, "vi", "mock") ||
          isMemberNamed(node.callee, "vi", "doMock") ||
          isMemberNamed(node.callee, "jest", "mock") ||
          isMemberNamed(node.callee, "jest", "doMock")
        ) {
          reportRuleViolation(
            context,
            node,
            "Avoid module mocking; inject an explicit dependency seam instead.",
          );
        }
      },
    };
  },
});
