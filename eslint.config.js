// https://docs.expo.dev/guides/using-eslint/
// Правила воспроизводят @lad-tech/eslint-config на ESLint 9 (flat config).
// Базовый слой — eslint-config-expo (React Native), поверх — правила lad-tech.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const sonarjs = require('eslint-plugin-sonarjs');
const jest = require('eslint-plugin-jest');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  // Базовые правила Expo / React Native.
  expoConfig,

  // Рекомендованный набор SonarJS.
  sonarjs.configs.recommended,

  // Правила lad-tech. Плагины @typescript-eslint/react/react-hooks/import
  // зарегистрированы в expoConfig для TS/TSX, поэтому правила ограничиваем теми же файлами.
  {
    files: ['**/*.{ts,tsx}'],
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
        node: true,
      },
      react: {
        version: 'detect',
      },
    },
    rules: {
      'import/order': [
        'error',
        {
          'newlines-between': 'always',
        },
      ],

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'lodash',
              message: 'Import [module] from lodash/[module] instead.',
            },
            {
              name: 'react-redux',
              importNames: ['useSelector', 'useDispatch'],
              message: 'Use typed hooks `useAppDispatch` and `useAppSelector` instead.',
            },
            {
              name: 'dayjs',
              message: 'Use import from "@shared/lib/dayjs" instead',
            },
          ],
          patterns: [
            {
              group: [
                'antd',
                '!@refinedev/antd',
                '@ant-design',
                'rc-*',
                '@lad-tech/mobydick-*',
                '@lad-tech/keyboard-aware',
              ],
              message: 'Use import from "@shared/ui" instead',
            },
          ],
        },
      ],

      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': 'allow-with-description',
          'ts-nocheck': true,
          'ts-check': false,
          minimumDescriptionLength: 5,
        },
      ],

      'react/prop-types': 'off',
      'react/require-default-props': 'off',
      'react/no-unused-prop-types': 'off',

      // Enum-стиль проекта (const-object + одноимённый производный тип, PDR §6) — это не
      // переобъявление: значение и тип живут в разных пространствах имён. Отключаем ложное срабатывание.
      '@typescript-eslint/no-redeclare': 'off',

      'react/react-in-jsx-scope': 'off',
      'react/jsx-filename-extension': ['error', { extensions: ['.ts', '.tsx'] }],

      'react/jsx-no-target-blank': 'warn',

      'sonarjs/no-duplicate-string': [
        'error',
        { ignoreStrings: 'lower-case,text/plain,Content-Type,space-between,flex-start,flex-end' },
      ],
    },
  },

  // Правила Jest только для тестовых файлов.
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.{test,spec}.{ts,tsx}'],
    ...jest.configs['flat/recommended'],
  },

  // Prettier — последним, чтобы отключить конфликтующие стилевые правила.
  prettierRecommended,

  {
    // dist — сборка; design — reference-прототипы дизайна (browser JSX/HTML), не исходники приложения.
    ignores: ['dist/*', 'design/**'],
  },
]);
