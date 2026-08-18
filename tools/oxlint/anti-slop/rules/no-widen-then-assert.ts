import { defineRule, type ESTree } from "@oxlint/plugins";

import {
  getIdentifierName,
  isUnknownType,
  reportRuleViolation,
} from "../rule-helpers.ts";

export const noWidenThenAssertRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Do not widen a known value to unknown before asserting it back.",
    },
  },
  create(context) {
    const widenedNames = new Set<string>();
    const checkAssertion = (
      node: ESTree.Node,
      expression: ESTree.Node,
    ): void => {
      const name = getIdentifierName(expression);
      if (name && widenedNames.has(name)) {
        reportRuleViolation(
          context,
          node,
          "Do not widen a known value to unknown before asserting it back.",
        );
      }
    };

    return {
      Program() {
        widenedNames.clear();
      },
      VariableDeclarator(node: ESTree.VariableDeclarator) {
        if (
          node.id.type === "Identifier" &&
          node.id.typeAnnotation?.typeAnnotation &&
          isUnknownType(node.id.typeAnnotation.typeAnnotation)
        ) {
          widenedNames.add(node.id.name);
        }
      },
      TSAsExpression(node: ESTree.TSAsExpression) {
        checkAssertion(node, node.expression);
      },
      TSTypeAssertion(node: ESTree.TSTypeAssertion) {
        checkAssertion(node, node.expression);
      },
    };
  },
});
