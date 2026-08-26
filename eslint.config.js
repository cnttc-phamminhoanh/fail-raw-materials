const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  // Common rules
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": "warn",
    },
  },

  // Node.js
  {
    files: [
      "server.js",
      "**/*.server.js",
      "routes/**/*.js",
      "controllers/**/*.js",
      "services/**/*.js",
      "repositories/**/*.js",
      "config/**/*.js",
      "database/**/*.js",
      "utils/**/*.js",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Browser
  {
    files: ["public/**/*.js", "ui/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
];
