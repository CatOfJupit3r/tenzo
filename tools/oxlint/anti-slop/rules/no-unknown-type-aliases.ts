import { defineRule, type ESTree } from "@oxlint/plugins";

import { reportRuleViolation, isUnknownType } from "../rule-helpers.ts";

export const noUnknownTypeAliasesRule = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Do not hide unknown behind a type alias." },
  },
  create(context) {
    return {
      TSTypeAliasDeclaration(node: ESTree.TSTypeAliasDeclaration) {
        if (isUnknownType(node.typeAnnotation)) {
          reportRuleViolation(
            context,
            node.typeAnnotation,
            "Do not alias unknown; define a parsed boundary contract.",
          );
        }
      },
    };
  },
});
