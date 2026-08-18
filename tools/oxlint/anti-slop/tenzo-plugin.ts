import { definePlugin } from "@oxlint/plugins";

import { noDirectRuntimeDetectionRule } from "./rules/no-direct-runtime-detection.ts";
import { noTrivialTestAssertionRule } from "./rules/no-trivial-test-assertion.ts";

export default definePlugin({
  meta: { name: "tenzo" },
  rules: {
    "no-direct-runtime-detection": noDirectRuntimeDetectionRule,
    "no-trivial-test-assertion": noTrivialTestAssertionRule,
  },
});
