import { defineRule, type ESTree } from "@oxlint/plugins";

import { reportRuleViolation } from "../rule-helpers.ts";

const isRecordType = (node: ESTree.Node | null | undefined): boolean =>
  node?.type === "TSTypeReference" &&
  node.typeName.type === "Identifier" &&
  node.typeName.name === "Record";

const isJsonValueRecord = (node: ESTree.Node): boolean =>
  node.type === "TSTypeReference" &&
  node.typeArguments !== null &&
  node.typeArguments.params.length === 2 &&
  node.typeArguments.params[1].type === "TSTypeReference" &&
  node.typeArguments.params[1].typeName.type === "Identifier" &&
  ["JsonValue", "iJsonValue"].includes(
    node.typeArguments.params[1].typeName.name,
  );

export const noKnownValueWideningRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Preserve known object keys with inference or satisfies.",
    },
  },
  create(context) {
    return {
      VariableDeclarator(node: ESTree.VariableDeclarator) {
        if (
          node.id.type === "Identifier" &&
          node.id.typeAnnotation?.typeAnnotation &&
          isRecordType(node.id.typeAnnotation.typeAnnotation) &&
          node.init?.type === "ObjectExpression" &&
          node.init.properties.length > 0 &&
          node.parent.type === "VariableDeclaration" &&
          node.parent.kind === "const" &&
          !isJsonValueRecord(node.id.typeAnnotation.typeAnnotation)
        ) {
          reportRuleViolation(
            context,
            node.id.typeAnnotation,
            "Preserve known object keys with inference or satisfies instead of widening the value.",
          );
        }
      },
    };
  },
});
