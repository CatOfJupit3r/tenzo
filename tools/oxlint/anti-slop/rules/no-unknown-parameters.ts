import { defineRule, type Context, type ESTree } from "@oxlint/plugins";

import {
  getFunctionName,
  getIdentifierName,
  isBoundaryNormalizationName,
  isCallbackFunction,
  isUnknownType,
  reportRuleViolation,
} from "../rule-helpers.ts";

const getParameterType = (node: ESTree.Node): ESTree.Node | null => {
  if (node.type === "Identifier" && node.typeAnnotation?.typeAnnotation) {
    return node.typeAnnotation.typeAnnotation;
  }
  if (node.type === "TSParameterProperty") {
    return getParameterType(node.parameter);
  }
  return null;
};

const isAllowedParameter = (node: ESTree.Node): boolean => {
  const name = getIdentifierName(node);
  return name === "cause" || name === "error" || name === "exception";
};

const checkParameters = (
  context: Context,
  node: ESTree.Node & { params: readonly ESTree.Node[] },
): void => {
  const functionName = getFunctionName(node);
  if (
    isCallbackFunction(node) ||
    context.filename.includes(".test.") ||
    (functionName !== null && isBoundaryNormalizationName(functionName))
  ) {
    return;
  }

  for (const parameter of node.params) {
    if (
      isAllowedParameter(parameter) ||
      !isUnknownType(getParameterType(parameter))
    ) {
      continue;
    }
    reportRuleViolation(
      context,
      parameter,
      "Parse unknown input at the application boundary before using it.",
    );
  }
};

export const noUnknownParametersRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require application boundaries to parse unknown parameters.",
    },
  },
  create(context) {
    return {
      FunctionDeclaration(node: ESTree.Function) {
        checkParameters(context, node);
      },
      FunctionExpression(node: ESTree.Function) {
        checkParameters(context, node);
      },
      ArrowFunctionExpression(node: ESTree.ArrowFunctionExpression) {
        checkParameters(context, node);
      },
    };
  },
});
