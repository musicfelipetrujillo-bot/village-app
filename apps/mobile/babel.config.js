module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@screens': './src/screens',
            '@components': './src/components',
            '@store': './src/store',
            '@hooks': './src/hooks',
            '@api': './src/api',
            '@utils': './src/utils',
          },
        },
      ],
      // Reanimated 4 moved the plugin into react-native-worklets.
      'react-native-worklets/plugin',
    ],
  };
};
