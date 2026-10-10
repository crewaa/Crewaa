import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react-native';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { PeacockColors } from '../constants/Colors';
import { UnreadCountResponse } from '../types';

interface NotificationBellProps {
  style?: ViewStyle;
}

export function NotificationBell({ style }: NotificationBellProps) {
  const router = useRouter();
  const { user } = useAuth();

  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const res = await api.get<UnreadCountResponse>('/notifications/unread-count');
      return res.data;
    },
    refetchInterval: 15000,
    enabled: !!user,
  });

  const unreadCount = unreadData?.unread ?? 0;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push('/notifications' as any)}
      accessibilityLabel="Notifications"
      style={[styles.container, style]}
    >
      <Bell size={21} color={PeacockColors.text} />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: PeacockColors.teal,
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: PeacockColors.deep,
  },
  badgeText: {
    color: PeacockColors.onTeal,
    fontSize: 9,
    fontWeight: '800',
  },
});
