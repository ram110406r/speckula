module.exports = {
  root: true,
  ignorePatterns: ['dist/', 'node_modules/', 'prisma/migrations/'],
  env: {
    node: true,
    es2020: true,
  },
  overrides: [
    {
      files: ['*.ts'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: ['eslint:recommended'],
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      rules: {
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
          },
        ],
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    },
    {
      files: ['**/*.test.ts'],
      env: {
        jest: true,
      },
    },
  ],
};
