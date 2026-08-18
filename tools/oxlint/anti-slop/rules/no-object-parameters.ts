import { defineRule, type ESTree } from "@oxlint/plugins";

import {
  getFunctionName,
  isBoundaryNormalizationName,
  reportRuleViolation,
} from "../rule-helpers.ts";

const hasObjectType = (node: ESTree.Node | null | undefined): boolean =>
  node?.type === "TSObjectKeyword" ||
  (node?.type === "TSTypeLiteral" && node.members.length === 0);

const getParameterType = (node: ESTree.Node): ESTree.Node | null => {
  if (node.type === "Identifier" && node.typeAnnotation?.typeAnnotation) {
    return node.typeAnnotation.typeAnnotation;
  }
  if (node.type === "TSParameterProperty") {
    return getParameterType(node.parameter);
  }
  return null;
};

export const noObjectParametersRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Use a concrete object contract instead of the broad object parameter type.",
    },
  },
  create(context) {
    const check = (
      node: ESTree.Node & { params: readonly ESTree.Node[] },
    ): void => {
      const functionName = getFunctionName(node);
      if (functionName !== null && isBoundaryNormalizationName(functionName)) {
        return;
      }
      for (const parameter of node.params) {
        if (hasObjectType(getParameterType(parameter))) {
          reportRuleViolation(
            context,
            parameter,
            "Use a named object contract instead of the broad object type.",
          );
        }
      }
    };

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
    };
  },
});
