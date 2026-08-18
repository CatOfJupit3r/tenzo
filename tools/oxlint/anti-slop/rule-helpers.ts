import type { Context, ESTree } from "@oxlint/plugins";

export const reportRuleViolation = (
  context: Context,
  node: ESTree.Node,
  message: string,
): void => {
  context.report({ node, message });
};

export const isIdentifierNamed = (
  node: ESTree.Node | null | undefined,
  name: string,
): boolean => node?.type === "Identifier" && node.name === name;

export const isMemberNamed = (
  node: ESTree.Node | null | undefined,
  objectName: string,
  propertyName: string,
): boolean =>
  node?.type === "MemberExpression" &&
  !node.computed &&
  isIdentifierNamed(node.object, objectName) &&
  node.property.name === propertyName;

export const isUnknownType = (
  node: ESTree.Node | null | undefined,
): boolean => {
  if (!node) {
    return false;
  }

  if (node.type === "TSUnknownKeyword") {
    return true;
  }

  if (node.type === "TSParenthesizedType") {
    return isUnknownType(node.typeAnnotation);
  }

  if (node.type !== "TSTypeReference" || node.typeName.type !== "Identifier") {
    return false;
  }

  if (
    node.typeName.name !== "Promise" ||
    !node.typeArguments ||
    node.typeArguments.params.length !== 1
  ) {
    return false;
  }

  return isUnknownType(node.typeArguments.params[0]);
};

export const isUnsafeDictionaryValueType = (
  node: ESTree.Node | null | undefined,
): boolean => {
  if (!node) {
    return false;
  }

  if (
    node.type === "TSUnknownKeyword" ||
    node.type === "TSAnyKeyword" ||
    node.type === "TSObjectKeyword"
  ) {
    return true;
  }

  if (node.type === "TSTypeLiteral" && node.members.length === 0) {
    return true;
  }

  return (
    node.type === "TSParenthesizedType" &&
    isUnsafeDictionaryValueType(node.typeAnnotation)
  );
};

export const hasSafetyComment = (
  context: Context,
  node: ESTree.Node,
): boolean =>
  context.sourceCode
    .getCommentsBefore(node)
    .some((comment) => /\bSAFETY\s*:/i.test(comment.value));

export const isConstAssertion = (node: ESTree.TSType): boolean =>
  node.type === "TSTypeReference" &&
  node.typeName.type === "Identifier" &&
  node.typeName.name === "const";

export const getIdentifierName = (
  node: ESTree.Node | null | undefined,
): string | null => (node?.type === "Identifier" ? node.name : null);

export const isLiteralExpression = (
  node: ESTree.Node | null | undefined,
): boolean => node?.type === "Literal" || node?.type === "TemplateLiteral";

export const isBoundaryLikeIdentifier = (name: string): boolean =>
  [
    "input",
    "value",
    "payload",
    "data",
    "raw",
    "unknownValue",
    "response",
  ].includes(name);

export const isBoundaryNormalizationName = (name: string): boolean =>
  /^(parse|sanitize|serialize|stringify|collect|append|read|to|decode|encode|normalize|extract|destructure|are|is|get|coerce)/.test(
    name,
  );

export const getFunctionName = (node: ESTree.Node): string | null => {
  if (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression"
  ) {
    return node.id?.name ?? null;
  }

  if (node.type !== "ArrowFunctionExpression") {
    return null;
  }

  const parent = node.parent;
  if (
    parent?.type === "VariableDeclarator" &&
    parent.id.type === "Identifier"
  ) {
    return parent.id.name;
  }
  if (parent?.type === "Property" && parent.key.type === "Identifier") {
    return parent.key.name;
  }
  return null;
};

export const isCallbackFunction = (node: ESTree.Node): boolean => {
  let parent: ESTree.Node | null = node.parent;
  while (parent !== null) {
    if (
      parent.type === "CallExpression" ||
      parent.type === "NewExpression" ||
      parent.type === "Property" ||
      parent.type === "JSXAttribute"
    ) {
      return true;
    }
    if (
      parent.type === "FunctionDeclaration" ||
      parent.type === "FunctionExpression" ||
      parent.type === "ArrowFunctionExpression"
    ) {
      return false;
    }
    parent = parent.parent;
  }
  return false;
};

export const isInsideCallback = (node: ESTree.Node): boolean => {
  let current: ESTree.Node | null = node.parent;
  while (current !== null) {
    if (
      current.type === "ArrowFunctionExpression" ||
      current.type === "FunctionExpression"
    ) {
      return isCallbackFunction(current);
    }
    if (current.type === "FunctionDeclaration") {
      return false;
    }
    current = current.parent;
  }
  return false;
};
