const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// pnpm uses symlinks — Metro must follow them to resolve packages installed
// in apps/mobile/node_modules that point into the pnpm store.
config.resolver.unstable_enableSymlinks = true;

// Stub native-only modules when bundling for web so dev preview works.
const webStubs = {
  'react-native-maps':          path.resolve(__dirname, 'src/lib/react-native-maps.web.ts'),
  '@stripe/stripe-react-native': path.resolve(__dirname, 'src/lib/stripe-react-native.web.ts'),
  'expo-secure-store':           path.resolve(__dirname, 'src/lib/expo-secure-store.web.ts'),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webStubs[moduleName]) {
    return { type: 'sourceFile', filePath: webStubs[moduleName] };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
