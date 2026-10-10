import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth-context';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PeacockColors } from '../../constants/Colors';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: PeacockColors.bg }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 48,
          maxWidth: 480,
          width: '100%',
          alignSelf: 'center',
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Text
            style={{
              color: PeacockColors.teal,
              fontSize: 36,
              fontWeight: '800',
              letterSpacing: -0.5,
              marginBottom: 8,
            }}
          >
            crewaa
          </Text>
          <Text
            style={{
              color: PeacockColors.text,
              fontSize: 26,
              fontWeight: '700',
              textAlign: 'center',
            }}
          >
            Welcome Back
          </Text>
          <Text
            style={{
              color: PeacockColors.muted,
              fontSize: 14,
              textAlign: 'center',
              marginTop: 6,
            }}
          >
            Sign in to access your Creator or Brand Studio
          </Text>
        </View>

        <Card elevated style={{ marginBottom: 24 }}>
          {error ? (
            <View
              style={{
                backgroundColor: 'rgba(242, 113, 107, 0.15)',
                borderColor: 'rgba(242, 113, 107, 0.35)',
                borderWidth: 1,
                borderRadius: 12,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <Text style={{ color: PeacockColors.danger, fontSize: 13, fontWeight: '500' }}>
                {error}
              </Text>
            </View>
          ) : null}

          <Input
            label="Email Address"
            placeholder="you@crewaa.in"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Button
            title="Sign In"
            variant="primary"
            loading={loading}
            onPress={handleLogin}
            style={{ marginTop: 8 }}
          />
        </Card>

        {/* Links */}
        <View style={{ gap: 12 }}>
          <Button
            title="Don't have an account? Sign Up"
            variant="outline"
            onPress={() => router.push('/(auth)/signup')}
          />

          <Button
            title="Explore as Guest"
            variant="ghost"
            onPress={() => router.replace('/(tabs)')}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
