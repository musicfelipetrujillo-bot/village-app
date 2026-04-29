const expo = require('eslint-config-expo/flat');

module.exports = [
  ...expo,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**'],
  },
  {
    rules: {
      'import/no-unresolved': 'off',
      'react/display-name': 'off',
      // In React Native, <Text> children are not rendered as HTML — apostrophes
      // and quotes are safe. Downgrade from error to warn so lint stays green.
      'react/no-unescaped-entities': 'warn',
    },
  },
];
