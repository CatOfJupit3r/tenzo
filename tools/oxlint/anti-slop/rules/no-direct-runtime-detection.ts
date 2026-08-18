import { defineRule, type ESTree } from "@oxlint/plugins";

import { isIdentifierNamed, reportRuleViolation } from "../rule-helpers.ts";

const isEnvironmentOwner = (filename: string): boolean => {
  const normalizedFilename = filename.replaceAll("\\", "/");
  return (
    normalizedFilename.endsWith("/ssr-helpers.ts") ||
    normalizedFilename.endsWith("/ssr-helpers.tsx")
  );
};

const isBrowserGlobal = (node: ESTree.Node): boolean =>
  isIdentifierNamed(node, "window") ||
  isIdentifierNamed(node, "document") ||
  (node.type === "Literal" &&
    (node.value === "window" || node.value === "document"));

const isGlobalThisBrowserMember = (node: ESTree.Node): boolean =>
  node.type === "MemberExpression" &&
  isIdentifierNamed(node.object, "globalThis") &&
  ((node.computed && isBrowserGlobal(node.property)) ||
    (!node.computed &&
      (node.property.name === "window" || node.property.name === "document")));

const isPresenceComparison = (node: ESTree.BinaryExpression): boolean => {
  if (node.operator === "in") {
    return (
      isBrowserGlobal(node.left) && isIdentifierNamed(node.right, "globalThis")
    );
  }

  const hasUndefined =
    isIdentifierNamed(node.left, "undefined") ||
    isIdentifierNamed(node.right, "undefined");
  return (
    hasUndefined &&
    (isGlobalThisBrowserMember(node.left) ||
      isGlobalThisBrowserMember(node.right))
  );
};

export const noDirectRuntimeDetectionRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Use the application-owned runtime environment source instead of browser-global checks.",
    },
  },
  create(context) {
    const shouldReport = !isEnvironmentOwner(context.filename);
    return {
      UnaryExpression(node: ESTree.UnaryExpression) {
        if (
          shouldReport &&
          node.operator === "typeof" &&
          isBrowserGlobal(node.argument)
        ) {
          reportRuleViolation(
            context,
            node,
            "Use isOnClient from ssr-helpers for runtime detection.",
          );
        }
        if (
          shouldReport &&
          node.operator === "typeof" &&
          isGlobalThisBrowserMember(node.argument)
        ) {
          reportRuleViolation(
            context,
            node,
            "Use isOnClient from ssr-helpers for runtime detection.",
          );
        }
      },
      BinaryExpression(node: ESTree.BinaryExpression) {
        if (shouldReport && isPresenceComparison(node)) {
          reportRuleViolation(
            context,
            node,
            "Use isOnClient from ssr-helpers for runtime detection.",
          );
        }
      },
    };
  },
});
