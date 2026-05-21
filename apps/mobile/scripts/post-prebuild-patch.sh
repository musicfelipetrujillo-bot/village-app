#!/usr/bin/env bash
# post-prebuild-patch.sh
#
# Re-applies the three path-with-spaces shell-script fixes that the iOS
# build needs whenever `expo prebuild --clean` regenerates `apps/mobile/ios/`.
# Companion to memory/project_ios26_build_fixes.md.
#
# Background: the project lives at "/Users/gp/The Village App/" — two
# spaces. Pods + main-app shell phases naively expand $PODS_TARGET_SRCROOT
# (or backtick-eval'd Node paths) inside `bash -l -c "..."` invocations,
# which causes the shell to interpret the path-with-space as multiple
# words → "bash: /Users/gp/The: No such file or directory" → BUILD FAILED.
#
# Sentry's `sentry-xcode.sh` is already pnpm-patched (see
# patches/@sentry__react-native.patch) and survives reinstalls. But the
# *.pbxproj fixes live INSIDE the regenerable ios/ folder, so they get
# wiped on every prebuild --clean. Hence this script.
#
# Idempotency: every sed/python edit uses a unique anchor string that the
# patched form no longer contains. Re-running on already-patched files is
# a no-op (and exits 0).
#
# Usage:
#   pnpm ios:patch                     # most common; see package.json
#   apps/mobile/scripts/post-prebuild-patch.sh
#   apps/mobile/scripts/post-prebuild-patch.sh --verify    # check only
set -euo pipefail

VERIFY_ONLY=0
if [ "${1:-}" = "--verify" ]; then VERIFY_ONLY=1; fi

cd "$(dirname "$0")/.."   # → apps/mobile

PODS_PBX="ios/Pods/Pods.xcodeproj/project.pbxproj"
APP_PBX="ios/villie.xcodeproj/project.pbxproj"
XCODE_ENV_LOCAL="ios/.xcode.env.local"

if [ ! -d ios ]; then
  echo "post-prebuild-patch: no ios/ folder — nothing to do. (Run 'expo prebuild' first.)"
  exit 0
fi

missing_anchors=0
report() {
  # $1 = label, $2 = found_count (>=1 means anchor present → still needs patching)
  if [ "$2" -gt 0 ]; then
    echo "  · $1 — anchor found ($2 occurrences) → would patch"
    missing_anchors=$((missing_anchors + 1))
  else
    echo "  · $1 — already patched (or anchor missing)"
  fi
}

echo "post-prebuild-patch · iOS path-with-spaces fixes"

# ── (1) Pods: EXConstants + expo-updates shell phases ───────────────
# Anchor: bash -l -c "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"
# Patched: bash -l -c "'$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh'"
# (single-quote wraps the inner path so bash treats it as one word.)
if [ -f "$PODS_PBX" ]; then
  c1=$(grep -c 'bash -l -c \\"\$PODS_TARGET_SRCROOT/\.\./scripts/get-app-config-ios\.sh\\"' "$PODS_PBX" || true)
  c2=$(grep -c 'bash -l -c \\"\$PODS_TARGET_SRCROOT/\.\./scripts/create-updates-resources-ios\.sh\\"' "$PODS_PBX" || true)
  report "Pods.xcodeproj · get-app-config-ios.sh"        "$c1"
  report "Pods.xcodeproj · create-updates-resources-ios" "$c2"

  if [ $VERIFY_ONLY -eq 0 ] && { [ "$c1" -gt 0 ] || [ "$c2" -gt 0 ]; }; then
    # macOS BSD sed needs '' after -i; the substitution wraps the inner
    # path in single quotes via shell-escape gymnastics ('"'"' = ' inside
    # a single-quoted shell string).
    sed -i.bak \
      -e 's|bash -l -c \\"\$PODS_TARGET_SRCROOT/\.\./scripts/get-app-config-ios\.sh\\"|bash -l -c \\"'"'"'\$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh'"'"'\\"|g' \
      -e 's|bash -l -c \\"\$PODS_TARGET_SRCROOT/\.\./scripts/create-updates-resources-ios\.sh\\"|bash -l -c \\"'"'"'\$PODS_TARGET_SRCROOT/../scripts/create-updates-resources-ios.sh'"'"'\\"|g' \
      "$PODS_PBX"
    rm -f "$PODS_PBX.bak"
    echo "  ✓ Pods.xcodeproj patched"
  fi
else
  echo "  · Pods.xcodeproj not found (skip — Pods step may not have run yet)"
fi

# ── (2) villie.xcodeproj — Bundle script + Sentry debug-files ───────
# Two backtick-evaluated Node paths that need wrapping in double quotes.
# Python is used because the source pattern has both literal backticks
# AND escaped double-quotes; getting sed to do this on macOS BSD is more
# pain than it's worth.
if [ -f "$APP_PBX" ]; then
  # Pattern 1: bundle script — TWO backticks back-to-back
  c1=$(grep -c '/bin/sh `\\\"\$NODE_BINARY\\\" --print \\\"require..path..\.dirname.require\.resolve...@sentry/react-native/package\.json...... + ..\/scripts\/sentry-xcode\.sh.\\\"` `\\\"\$NODE_BINARY\\\" --print \\\"require..path..\.dirname.require\.resolve...react-native/package\.json...... + ..\/scripts\/react-native-xcode\.sh.\\\"`' "$APP_PBX" || true)
  # Pattern 2: sentry debug files — ONE backtick
  c2=$(grep -c '/bin/sh `\${NODE_BINARY:-node} --print \\\"require..path..\.dirname.require\.resolve...@sentry/react-native/package\.json...... + ..\/scripts\/sentry-xcode-debug-files\.sh.\\\"`' "$APP_PBX" || true)
  report "villie.xcodeproj · Bundle React Native + sentry-xcode" "$c1"
  report "villie.xcodeproj · Sentry debug-files"                  "$c2"

  if [ $VERIFY_ONLY -eq 0 ] && { [ "$c1" -gt 0 ] || [ "$c2" -gt 0 ]; }; then
    python3 - "$APP_PBX" <<'PYEOF'
import sys, pathlib
p = pathlib.Path(sys.argv[1])
s = p.read_text()
# Pattern 1
old1 = r"""/bin/sh `\"$NODE_BINARY\" --print \"require('path').dirname(require.resolve('@sentry/react-native/package.json')) + '/scripts/sentry-xcode.sh'\"` `\"$NODE_BINARY\" --print \"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\"`"""
new1 = r"""/bin/sh \"`\"$NODE_BINARY\" --print \"require('path').dirname(require.resolve('@sentry/react-native/package.json')) + '/scripts/sentry-xcode.sh'\"`\" \"`\"$NODE_BINARY\" --print \"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\"`\""""
# Pattern 2
old2 = r"""/bin/sh `${NODE_BINARY:-node} --print \"require('path').dirname(require.resolve('@sentry/react-native/package.json')) + '/scripts/sentry-xcode-debug-files.sh'\"`"""
new2 = r"""/bin/sh \"`${NODE_BINARY:-node} --print \"require('path').dirname(require.resolve('@sentry/react-native/package.json')) + '/scripts/sentry-xcode-debug-files.sh'\"`\""""
n1 = s.count(old1); n2 = s.count(old2)
s = s.replace(old1, new1).replace(old2, new2)
p.write_text(s)
print(f"  ✓ villie.xcodeproj patched ({n1} bundle + {n2} debug-files)")
PYEOF
  fi
else
  echo "  · villie.xcodeproj not found (skip)"
fi

# ── (3) .xcode.env.local — disable Sentry source-map upload for dev ─
# Apple Mail Privacy aside, Sentry's sourcemap upload requires SENTRY_ORG
# + SENTRY_PROJECT which we don't set for dev builds. Without
# SENTRY_DISABLE_AUTO_UPLOAD=true the build fails late with a sentry-cli
# error.
if [ -f "$XCODE_ENV_LOCAL" ]; then
  if grep -q "SENTRY_DISABLE_AUTO_UPLOAD" "$XCODE_ENV_LOCAL"; then
    report ".xcode.env.local · SENTRY_DISABLE_AUTO_UPLOAD" 0
  else
    report ".xcode.env.local · SENTRY_DISABLE_AUTO_UPLOAD" 1
    if [ $VERIFY_ONLY -eq 0 ]; then
      echo "export SENTRY_DISABLE_AUTO_UPLOAD=true" >> "$XCODE_ENV_LOCAL"
      echo "  ✓ .xcode.env.local appended"
    fi
  fi
else
  # Don't auto-create if the file doesn't exist — it's a machine-local
  # gitignored file and expo's prebuild seeds it with NODE_BINARY. If
  # it's missing entirely the user likely needs `expo prebuild` to run
  # first.
  echo "  · .xcode.env.local not found (skip — prebuild may not have created it)"
fi

echo
if [ $VERIFY_ONLY -eq 1 ]; then
  if [ $missing_anchors -gt 0 ]; then
    echo "post-prebuild-patch: $missing_anchors unpatched anchor(s) — run without --verify"
    exit 1
  fi
  echo "post-prebuild-patch: all patches present ✓"
else
  echo "post-prebuild-patch: done"
fi
