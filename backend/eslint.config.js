module.exports = [
  {
    ignores: ["node_modules/", "coverage/"]
  },
  {
    files: ["src/**/*.js", "tests/**/*.js", "scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        console: "readonly",
        describe: "readonly",
        expect: "readonly",
        it: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
        __dirname: "readonly"
      }
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": ["error", { argsIgnorePattern: "^next$" }],
      "prefer-const": "error"
    }
  }
];
