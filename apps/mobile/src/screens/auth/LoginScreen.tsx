import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '@utils/constants';
import { authService } from '@/lib/auth';
import type { AuthStackParamList } from '@/navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      await authService.signIn(email.trim(), password);
      // RootNavigator detects session and switches to App automatically
    } catch (err: any) {
      Alert.alert('Sign in failed', err.message ?? 'Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>
          The <Text style={styles.logoAccent}>Village</Text>
        </Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.sub}>Sign in to your account</Text>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="sofia@example.com"
              placeholderTextColor={COLORS.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor={COLORS.textLight}
              secureTextEntry
              autoComplete="current-password"
            />
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.forgotLink}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.btnText}>Sign In →</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text style={styles.footerLink}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  content: { padding: 28, paddingTop: 60, flexGrow: 1 },

  logo: { fontFamily: 'serif', fontSize: 28, color: COLORS.textDark, marginBottom: 24 },
  logoAccent: { color: COLORS.rust, fontStyle: 'italic' },

  title: {
    fontFamily: 'serif',
    fontSize: 32,
    color: COLORS.textDark,
    marginBottom: 6,
    fontStyle: 'italic',
  },
  sub: { fontSize: 14, color: COLORS.textLight, marginBottom: 32 },

  form: { gap: 16 },
  inputGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textMid },
  input: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.textDark,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
  },

  forgotLink: {
    fontSize: 13,
    color: COLORS.rust,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: -4,
  },

  btn: {
    backgroundColor: COLORS.rust,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: 'white', fontSize: 16, fontWeight: '700' },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { fontSize: 14, color: COLORS.textLight },
  footerLink: { fontSize: 14, color: COLORS.rust, fontWeight: '600' },
});
