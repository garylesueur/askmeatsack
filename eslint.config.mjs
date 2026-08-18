import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Rules generated from `.engineering/conventions.yaml`. Change the decision
 * there first — this file implements it, it does not own it.
 *
 * Not repeated here because `eslint-config-next/typescript` already errors on
 * them: `@typescript-eslint/no-explicit-any`.
 */
const conventions = [
  {
    // type-over-interface. Both codebases are 90 `type` to 0 `interface`, so
    // this can be an error from the day it lands. Expressed with core ESLint
    // rather than pulling typescript-eslint in as a direct dependency for one
    // rule, since it is only banning a syntax node.
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSInterfaceDeclaration",
          message: "Use `type` rather than `interface`. See .engineering/conventions.yaml.",
        },
      ],
    },
  },
  {
    // Import discipline: inside src/lib a relative import means "same layer",
    // so reaching for the alias there hides a boundary that does not exist.
    // src/app is the other way round and is left alone — crossing into lib is
    // exactly what the alias is for.
    files: ["src/lib/**/*.ts", "src/lib/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/*", "@/*"],
              message:
                "Inside src/lib, import siblings relatively. The alias is for crossing layers. See .engineering/conventions.yaml.",
            },
          ],
        },
      ],
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...conventions,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".agents/**",
    ".plans/**",
    ".reports/**",
  ]),
]);

export default eslintConfig;
