import { defineRule, type ESTree } from "@oxlint/plugins";

import {
  isIdentifierNamed,
  isLiteralExpression,
  reportRuleViolation,
} from "../rule-helpers.ts";

const isAssertionMatcher = (node: ESTree.Node): boolean =>
  node.type === "MemberExpression" &&
  !node.computed &&
  ["toBe", "toEqual", "toStrictEqual"].includes(node.property.name);

const isIdenticalLiteralEquality = (node: ESTree.BinaryExpression): boolean =>
  ["==", "===", "!=", "!=="].includes(node.operator) &&
  isLiteralExpression(node.left) &&
  isLiteralExpression(node.right);

export const noTrivialTestAssertionRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Reject assertions whose evidence is only a repeated literal.",
    },
  },
  create(context) {
    return {
      CallExpression(node: ESTree.CallExpression) {
        if (
          node.callee.type === "MemberExpression" &&
          isAssertionMatcher(node.callee) &&
          node.callee.object.type === "CallExpression" &&
          isIdentifierNamed(node.callee.object.callee, "expect") &&
          node.callee.object.arguments.length === 1 &&
          node.arguments.length === 1 &&
          isLiteralExpression(node.callee.object.arguments[0]) &&
          isLiteralExpression(node.arguments[0]) &&
          context.sourceCode.getText(node.callee.object.arguments[0]) ===
            context.sourceCode.getText(node.arguments[0])
        ) {
          reportRuleViolation(
            context,
            node,
            "Assert a behavior or domain result instead of repeating a literal.",
          );
        }
      },
      BinaryExpression(node: ESTree.BinaryExpression) {
        if (
          isIdenticalLiteralEquality(node) &&
          context.sourceCode.getText(node.left) ===
            context.sourceCode.getText(node.right)
        ) {
          reportRuleViolation(
            context,
            node,
            "Compare a meaningful value instead of identical literals.",
          );
        }
      },
    };
  },
});
