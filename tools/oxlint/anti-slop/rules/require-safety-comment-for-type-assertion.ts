import { defineRule, type Context, type ESTree } from "@oxlint/plugins";

import {
  getIdentifierName,
  getFunctionName,
  hasSafetyComment,
  isBoundaryNormalizationName,
  isBoundaryLikeIdentifier,
  isConstAssertion,
  isInsideCallback,
  reportRuleViolation,
} from "../rule-helpers.ts";

const needsSafetyComment = (
  context: Context,
  node: ESTree.Node,
  typeAnnotation: ESTree.TSType,
  expression: ESTree.Node,
): boolean =>
  !isConstAssertion(typeAnnotation) &&
  !isInsideBoundaryNormalization(node) &&
  isBoundaryLikeIdentifier(getIdentifierName(expression) ?? "") &&
  !isInsideCallback(node) &&
  !hasSafetyComment(context, node);

const isInsideBoundaryNormalization = (node: ESTree.Node): boolean => {
  let current: ESTree.Node | null = node.parent;
  while (current !== null) {
    const functionName = getFunctionName(current);
    if (functionName !== null) {
      return isBoundaryNormalizationName(functionName);
    }
    current = current.parent;
  }
  return false;
};

export const requireSafetyCommentForTypeAssertionRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Document the checked invariant behind a non-const type assertion.",
    },
  },
  create(context) {
    return {
      TSAsExpression(node: ESTree.TSAsExpression) {
        if (
          needsSafetyComment(
            context,
            node,
            node.typeAnnotation,
            node.expression,
          )
        ) {
          reportRuleViolation(
            context,
            node,
            "Add a SAFETY comment naming the invariant behind this assertion.",
          );
        }
      },
      TSTypeAssertion(node: ESTree.TSTypeAssertion) {
        if (
          needsSafetyComment(
            context,
            node,
            node.typeAnnotation,
            node.expression,
          )
        ) {
          reportRuleViolation(
            context,
            node,
            "Add a SAFETY comment naming the invariant behind this assertion.",
          );
        }
      },
    };
  },
});
