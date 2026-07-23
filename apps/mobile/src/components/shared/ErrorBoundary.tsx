// App-wide error boundary. Catches render errors anywhere below it, reports to
// Sentry, and shows a friendly retry screen instead of the white-screen-of-death
// you'd otherwise get on a JS exception inside React render.
//
// Wrapped around <RootNavigator/> in App.tsx. We deliberately keep the fallback
// dependency-free (no navigation hooks, no store reads) so it works even when
// the underlying state is the thing that crashed.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Sentry } from '@/lib/sentry';
import { COLORS, FONTS } from '@utils/constants';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Sentry is no-op when DSN is not set or in dev — safe to call always.
    try {
      Sentry?.captureException?.(error, {
        contexts: {
          react: { componentStack: info.componentStack ?? undefined },
        },
        tags: { boundary: 'root' },
      });
    } catch {
      /* telemetry must never break the fallback */
    }
    if (__DEV__) {
      // Surface in dev so the redbox / Metro logs still show the original.
       
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container} accessible accessibilityLabel="Something went wrong">
          <Text style={styles.emoji}>🌱</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            We hit an unexpected error. Tap "Try again" to reload the screen. If
            it keeps happening, restarting the app will get you back on track.
          </Text>
          {__DEV__ && (
            <Text style={styles.devError} numberOfLines={6}>
              {this.state.error.message}
            </Text>
          )}
          <TouchableOpacity
            style={styles.btn}
            onPress={this.reset}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={styles.btnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
    paddingHorizontal: 32,
    paddingTop: Platform.OS === 'ios' ? 120 : 80,
    alignItems: 'center',
  },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: {
    fontFamily: FONTS.headerBold,
    fontSize: 24,
    color: COLORS.bark,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.barkSoft,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  devError: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.cocoDeep,
    backgroundColor: 'rgba(184,92,56,0.08)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    width: '100%',
  },
  btn: {
    backgroundColor: '#E84B79',
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  btnText: {
    color: '#FFFCF6',
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
