import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';

export default tseslint.config(
  // Core JS Recommended rules
  js.configs.recommended,
  // Automated TypeScript Configurations
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react/react-in-jsx-scope': 'off',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // Global Ignores
  {
    ignores: [
      '.next/',
      'node_modules/',
      'dist/',
      'lib/generated/',
      'commitlint.config.js',
      'commitlint.config.cjs',
    ],
  },
);
