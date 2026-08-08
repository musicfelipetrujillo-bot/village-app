// withModularHeaders — Expo config plugin (2026-08-07)
//
// Fixes an iOS `pod install` failure introduced by a floated transitive pod:
//
//   [!] The following Swift pods cannot yet be integrated as static libraries:
//   The Swift pod `AppCheckCore` depends upon `GoogleUtilities` and
//   `RecaptchaInterop`, which do not define modules. ... set
//   `use_modular_headers!` globally, or `:modular_headers => true` for
//   particular dependencies.
//
// AppCheckCore/GoogleUtilities/RecaptchaInterop arrive transitively via
// @react-native-google-signin/google-signin. With CocoaPods static libraries
// (this app uses no `use_frameworks!`), a Swift pod can't link a dependency
// that emits no module map. We opt the specific non-modular deps into module
// maps — the surgical fix, leaving React/Expo core pods untouched.
//
// EAS runs `expo prebuild` on every build, which regenerates the Podfile, so
// this has to be a plugin (a hand-edit to ios/Podfile would be overwritten).
// The dangerous mod runs after the Podfile template is written and patches the
// on-disk file; it's idempotent via a marker comment so re-runs never dupe.

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = 'MODULAR_HEADERS_PATCH';
const PODS = ['GoogleUtilities', 'RecaptchaInterop', 'AppCheckCore'];

module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (contents.includes(MARKER)) return cfg;

      const inject =
        `\n  # ${MARKER}: GoogleSignIn's AppCheckCore (Swift) needs its non-modular\n` +
        `  # deps to emit module maps to link as static libraries (fixes pod install).\n` +
        PODS.map((p) => `  pod '${p}', :modular_headers => true`).join('\n') +
        '\n';

      // Insert right after `use_expo_modules!` inside the app target.
      const anchor = /(\n[ \t]*use_expo_modules!\s*\n)/;
      if (anchor.test(contents)) {
        contents = contents.replace(anchor, `$1${inject}`);
      } else {
        // Fallback: after the first `target '...' do` line.
        contents = contents.replace(/(\ntarget\s+['"][^'"]+['"]\s+do\s*\n)/, `$1${inject}`);
      }

      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
};
