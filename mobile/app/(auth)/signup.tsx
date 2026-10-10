import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Briefcase, Sparkles } from 'lucide-react-native';
import { useAuth } from '../../lib/auth-context';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PeacockColors } from '../../constants/Colors';
import { Role } from '../../types';

export default function SignupScreen() {
  const router = useRouter();
  const { signup } = useAuth();
  const [role, setRole] = useState<Role>('INFLUENCER');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await signup(email.trim(), password, role);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Signup failed. Please try again.');
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
        <View style={{ alignItems: 'center', marginBottom: 28 }}>
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
            Create an Account
          </Text>
          <Text
            style={{
              color: PeacockColors.muted,
              fontSize: 14,
              textAlign: 'center',
              marginTop: 6,
            }}
          >
            Choose your role to get started
          </Text>
        </View>

        {/* Role Selector */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
          <Pressable
            onPress={() => setRole('INFLUENCER')}
            style={{
              flex: 1,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1.5,
              alignItems: 'center',
              backgroundColor: role === 'INFLUENCER' ? 'rgba(38, 189, 176, 0.15)' : PeacockColors.surface,
              borderColor: role === 'INFLUENCER' ? PeacockColors.teal : PeacockColors.line,
            }}
          >
            <Sparkles
              size={24}
              color={role === 'INFLUENCER' ? PeacockColors.teal : PeacockColors.muted}
            />
            <Text
              style={{
                marginTop: 8,
                fontWeight: '700',
                fontSize: 15,
                color: role === 'INFLUENCER' ? PeacockColors.teal : PeacockColors.text,
              }}
            >
              Creator
            </Text>
            <Text style={{ fontSize: 11, color: PeacockColors.muted, textAlign: 'center', marginTop: 2 }}>
              Get deals & grow
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setRole('BRAND')}
            style={{
              flex: 1,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1.5,
              alignItems: 'center',
              backgroundColor: role === 'BRAND' ? 'rgba(79, 179, 217, 0.15)' : PeacockColors.surface,
              borderColor: role === 'BRAND' ? PeacockColors.blue : PeacockColors.line,
            }}
          >
            <Briefcase
              size={24}
              color={role === 'BRAND' ? PeacockColors.blue : PeacockColors.muted}
            />
            <Text
              style={{
                marginTop: 8,
                fontWeight: '700',
                fontSize: 15,
                color: role === 'BRAND' ? PeacockColors.blue : PeacockColors.text,
              }}
            >
              Brand
            </Text>
            <Text style={{ fontSize: 11, color: PeacockColors.muted, textAlign: 'center', marginTop: 2 }}>
              Hire verified creators
            </Text>
          </Pressable>
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
            placeholder="At least 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Button
            title="Create Account"
            variant="primary"
            loading={loading}
            onPress={handleSignup}
            style={{ marginTop: 8 }}
          />
        </Card>

        {/* Links */}
        <Button
          title="Already have an account? Sign In"
          variant="outline"
          onPress={() => router.push('/(auth)/login')}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
