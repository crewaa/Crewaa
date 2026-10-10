import React from 'react';
import {
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  CheckCircle,
  LogIn,
  LogOut,
  Mail,
  Shield,
  User,
} from 'lucide-react-native';
import { useAuth } from '../../lib/auth-context';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PeacockColors } from '../../constants/Colors';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: PeacockColors.bg }}
      contentContainerStyle={{
        padding: 20,
        paddingBottom: 48,
        maxWidth: 480,
        width: '100%',
        alignSelf: 'center',
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* User Header */}
      <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 8 }}>
        <View
          style={{
            height: 80,
            width: 80,
            borderRadius: 40,
            backgroundColor: PeacockColors.surface,
            borderWidth: 2,
            borderColor: PeacockColors.teal,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
          }}
        >
          <User size={40} color={PeacockColors.teal} />
        </View>
        <Text style={{ color: PeacockColors.text, fontSize: 20, fontWeight: '700' }}>
          {user?.email || 'Guest User'}
        </Text>
        <View style={{ marginTop: 8 }}>
          <Badge
            label={user?.role || 'NOT SIGNED IN'}
            variant={user?.role === 'BRAND' ? 'blue' : 'teal'}
          />
        </View>
      </View>

      {/* Account Info Card */}
      <Card elevated style={{ marginBottom: 20 }}>
        <Text style={{ color: PeacockColors.text, fontSize: 17, fontWeight: '700', marginBottom: 14 }}>
          Account Overview
        </Text>

        <View style={{ gap: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 6,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(28, 59, 67, 0.5)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Mail size={16} color={PeacockColors.muted} />
              <Text style={{ color: PeacockColors.muted, fontSize: 14 }}>Email</Text>
            </View>
            <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '500' }}>
              {user?.email || '—'}
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 6,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(28, 59, 67, 0.5)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Shield size={16} color={PeacockColors.muted} />
              <Text style={{ color: PeacockColors.muted, fontSize: 14 }}>Role</Text>
            </View>
            <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '500' }}>
              {user?.role || 'None'}
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 6,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={16} color={PeacockColors.ok} />
              <Text style={{ color: PeacockColors.muted, fontSize: 14 }}>Theme</Text>
            </View>
            <Text style={{ color: PeacockColors.teal, fontSize: 14, fontWeight: '600' }}>
              Royal Peacock (Dark)
            </Text>
          </View>
        </View>
      </Card>

      {/* Actions */}
      <View style={{ gap: 12, marginTop: 8 }}>
        {user ? (
          <Button
            title="Log Out"
            variant="danger"
            icon={<LogOut size={16} color={PeacockColors.text} />}
            onPress={handleLogout}
          />
        ) : (
          <Button
            title="Sign In / Register"
            variant="primary"
            icon={<LogIn size={18} color={PeacockColors.onTeal} />}
            onPress={() => router.push('/(auth)/login')}
          />
        )}
      </View>
    </ScrollView>
  );
}
