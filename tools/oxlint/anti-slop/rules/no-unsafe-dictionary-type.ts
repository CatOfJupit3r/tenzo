import { defineRule, type ESTree } from "@oxlint/plugins";

import {
  isUnsafeDictionaryValueType,
  reportRuleViolation,
} from "../rule-helpers.ts";

const isRecordOfUnsafeValue = (node: ESTree.TSTypeReference): boolean =>
  node.typeName.type === "Identifier" &&
  node.typeName.name === "Record" &&
  node.typeArguments !== null &&
  node.typeArguments.params.length === 2 &&
  isUnsafeDictionaryValueType(node.typeArguments.params[1]);

const isDirectVariableAnnotation = (node: ESTree.TSTypeReference): boolean =>
  node.parent.type === "TSTypeAnnotation" &&
  node.parent.parent.type === "VariableDeclarator" &&
  node.parent.parent.id.type === "Identifier";

const isAllowedTypeAlias = (node: ESTree.TSTypeReference): boolean =>
  node.parent.type === "TSTypeAliasDeclaration" &&
  node.parent.id.name === "LogContext";

export const noUnsafeDictionaryTypeRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Use a concrete schema-backed value type for dictionaries.",
    },
  },
  create(context) {
    return {
      TSTypeReference(node: ESTree.TSTypeReference) {
        if (
          !context.filename.endsWith(".d.ts") &&
          isRecordOfUnsafeValue(node) &&
          (isDirectVariableAnnotation(node) ||
            node.parent.type === "TSTypeAliasDeclaration") &&
          !isAllowedTypeAlias(node)
        ) {
          reportRuleViolation(
            context,
            node,
            "Do not use an unsafe dictionary value type; define its accepted shape.",
          );
        }
      },
      TSIndexSignature(node: ESTree.TSIndexSignature) {
        if (isUnsafeDictionaryValueType(node.typeAnnotation.typeAnnotation)) {
          reportRuleViolation(
            context,
            node,
            "Do not use an unsafe dictionary value type; define its accepted shape.",
          );
        }
      },
    };
  },
});
