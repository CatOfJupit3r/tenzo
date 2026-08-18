import { defineRule, type ESTree } from "@oxlint/plugins";

import {
  getFunctionName,
  isBoundaryNormalizationName,
  isUnknownType,
  reportRuleViolation,
} from "../rule-helpers.ts";

const getReturnType = (node: ESTree.Node): ESTree.Node | null => {
  if (!("returnType" in node) || !node.returnType?.typeAnnotation) {
    return null;
  }
  return node.returnType.typeAnnotation;
};

export const noUnknownReturnsRule = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Return parsed domain values rather than unknown." },
  },
  create(context) {
    const check = (node: ESTree.Node): void => {
      const returnType = getReturnType(node);
      const functionName = getFunctionName(node);
      if (
        returnType &&
        isUnknownType(returnType) &&
        (functionName === null || !isBoundaryNormalizationName(functionName))
      ) {
        reportRuleViolation(
          context,
          returnType,
          "Return a parsed domain value instead of unknown.",
        );
      }
    };

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
      TSDeclareFunction: check,
    };
  },
});
