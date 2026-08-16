import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/**", "desktop/**", "node_modules/**"] },
  {
    files: [
      "src/app/**/*.js",
      "src/components/**/*.js",
      "src/hooks/**/*.js",
      "src/services/**/*.js",
      "src/lib/dom.js",
      "src/lib/html.js",
      "src/lib/time.js",
      "src/lib/index.js",
    ],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
    },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
  {
    files: ["src/server.js", "src/cli.js", "src/lib/classify.js", "src/lib/stay-awake.js", "scripts/**/*.js"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
];
