import { defineRule, type ESTree } from "@oxlint/plugins";

import { reportRuleViolation } from "../rule-helpers.ts";

const isEmptyObject = (node: ESTree.Node): boolean =>
  node.type === "ObjectExpression" && node.properties.length === 0;

export const noConditionalEmptyObjectSpreadRule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Avoid conditional spreads that use an empty object as an omission sentinel.",
    },
  },
  create(context) {
    return {
      SpreadElement(node: ESTree.SpreadElement) {
        if (
          node.argument.type === "ConditionalExpression" &&
          (isEmptyObject(node.argument.consequent) ||
            isEmptyObject(node.argument.alternate))
        ) {
          reportRuleViolation(
            context,
            node,
            "Use a typed optional property or an explicit transformation instead of a conditional empty-object spread.",
          );
        }
      },
    };
  },
});
