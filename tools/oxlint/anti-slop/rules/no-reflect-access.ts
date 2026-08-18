import { defineRule, type ESTree } from "@oxlint/plugins";

import { isMemberNamed, reportRuleViolation } from "../rule-helpers.ts";

const noReflectAccessRule = (memberName: "get" | "apply") =>
  defineRule({
    meta: {
      type: "problem",
      docs: {
        description: `Prefer typed property access over Reflect.${memberName}.`,
      },
    },
    create(context) {
      return {
        CallExpression(node: ESTree.CallExpression) {
          if (isMemberNamed(node.callee, "Reflect", memberName)) {
            reportRuleViolation(
              context,
              node,
              `Avoid Reflect.${memberName}; use a typed operation instead.`,
            );
          }
        },
      };
    },
  });

export const noReflectGetRule = noReflectAccessRule("get");
export const noReflectApplyRule = noReflectAccessRule("apply");
