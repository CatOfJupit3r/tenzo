import { defineRule, type Context, type ESTree } from "@oxlint/plugins";

import {
  getFunctionName,
  getIdentifierName,
  isBoundaryNormalizationName,
  isBoundaryLikeIdentifier,
  reportRuleViolation,
} from "../rule-helpers.ts";

const isRuntimeFunction = (
  node: ESTree.Node,
): node is ESTree.Function | ESTree.ArrowFunctionExpression =>
  node.type === "FunctionDeclaration" ||
  node.type === "FunctionExpression" ||
  node.type === "ArrowFunctionExpression";

const hasTypeGuardReturn = (node: ESTree.Node): boolean => {
  let current: ESTree.Node | null = node.parent;
  while (current !== null && current.type !== "Program") {
    if (isRuntimeFunction(current)) {
      return current.returnType?.typeAnnotation.type === "TSTypePredicate";
    }
    current = current.parent;
  }
  return false;
};

const isCauseOrCatchParameter = (node: ESTree.UnaryExpression): boolean => {
  const argumentName = getIdentifierName(node.argument);
  if (
    argumentName === "cause" ||
    argumentName === "error" ||
    argumentName === "exception"
  ) {
    return true;
  }

  let parent: ESTree.Node | null = node.parent;
  while (parent) {
    if (
      parent.type === "CatchClause" &&
      getIdentifierName(parent.param) === argumentName
    ) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
};

const isIgnoredByOptions = (
  context: Context,
  node: ESTree.UnaryExpression,
): boolean => {
  const options = context.options[0];
  const hasAllowInTypeGuards =
    typeof options === "object" &&
    options !== null &&
    "allowInTypeGuards" in options &&
    options.allowInTypeGuards === true;
  return hasAllowInTypeGuards && hasTypeGuardReturn(node);
};

export const noRuntimeTypeofRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Parse external values at boundaries instead of narrowing them with typeof.",
    },
    schema: [
      {
        type: "object",
        properties: { allowInTypeGuards: { type: "boolean" } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allowInTypeGuards: false }],
  },
  create(context) {
    return {
      UnaryExpression(node: ESTree.UnaryExpression) {
        const normalizedFilename = context.filename.replaceAll("\\", "/");
        let current: ESTree.Node | null = node.parent;
        while (current !== null) {
          const functionName = getFunctionName(current);
          if (
            functionName !== null &&
            isBoundaryNormalizationName(functionName)
          ) {
            return;
          }
          if (isRuntimeFunction(current)) {
            break;
          }
          current = current.parent;
        }
        if (normalizedFilename.endsWith("/components/ui/cropper.tsx")) {
          return;
        }
        if (
          node.operator !== "typeof" ||
          isIgnoredByOptions(context, node) ||
          isCauseOrCatchParameter(node)
        ) {
          return;
        }

        const argumentName = getIdentifierName(node.argument);
        if (argumentName === null || !isBoundaryLikeIdentifier(argumentName)) {
          return;
        }

        reportRuleViolation(
          context,
          node,
          "Parse boundary data with a schema instead of narrowing it with typeof.",
        );
      },
    };
  },
});
