import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '@utils/constants';
import { authService } from '@/lib/auth';
import type { AuthStackParamList } from '@/navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export default function SignUpScreen({ navigation, route }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Please fill in all fields');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await authService.signUp(email.trim(), password, fullName.trim());
      navigation.navigate('OnboardingProfile', { language: route.params?.language ?? 'en' });
    } catch (err: any) {
      Alert.alert('Sign up failed', err.message ?? 'Please try again.');
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
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.sub}>Join thousands of moms in Miami</Text>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Sofia Martinez"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="words"
              autoComplete="name"
            />
          </View>

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
              placeholder="At least 8 characters"
              placeholderTextColor={COLORS.textLight}
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.btnText}>Create Account →</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.legal}>
            By signing up you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}>Sign in</Text>
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

  btn: {
    backgroundColor: COLORS.rust,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: 'white', fontSize: 16, fontWeight: '700' },

  legal: {
    fontSize: 11,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 16,
  },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { fontSize: 14, color: COLORS.textLight },
  footerLink: { fontSize: 14, color: COLORS.rust, fontWeight: '600' },
});
