import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '@utils/constants';
import { authService } from '@/lib/auth';
import type { AuthStackParamList } from '@/navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) { Alert.alert('Enter your email'); return; }
    setLoading(true);
    try {
      await authService.resetPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Reset your{'\n'}password</Text>

        {sent ? (
          <View style={styles.sentCard}>
            <Text style={styles.sentEmoji}>📬</Text>
            <Text style={styles.sentTitle}>Check your email</Text>
            <Text style={styles.sentSub}>
              We sent a reset link to {email}. It may take a minute to arrive.
            </Text>
            <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.btnText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.sub}>
              Enter your email and we'll send you a link to reset your password.
            </Text>
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
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleReset}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.btnText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream, padding: 28, paddingTop: 60 },
  back: { marginBottom: 32 },
  backText: { fontSize: 15, color: COLORS.rust, fontWeight: '600' },
  title: {
    fontFamily: 'serif',
    fontSize: 34,
    color: COLORS.textDark,
    fontStyle: 'italic',
    marginBottom: 24,
    lineHeight: 42,
  },
  sub: { fontSize: 14, color: COLORS.textLight, marginBottom: 24, lineHeight: 22 },
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
  btn: {
    backgroundColor: COLORS.rust,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: 'white', fontSize: 16, fontWeight: '700' },

  sentCard: { alignItems: 'center', paddingTop: 40 },
  sentEmoji: { fontSize: 56, marginBottom: 16 },
  sentTitle: {
    fontFamily: 'serif',
    fontSize: 26,
    color: COLORS.textDark,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  sentSub: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
});
