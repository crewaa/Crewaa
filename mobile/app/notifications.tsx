import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BellOff,
  Briefcase,
  Check,
  CheckCircle2,
  Clapperboard,
  Heart,
  MessageCircle,
  Sparkles,
  Star,
  Users,
} from 'lucide-react-native';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PeacockColors } from '../constants/Colors';
import { NotificationItem, UnreadCountResponse } from '../types';

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: notifications,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['notifications-list'],
    queryFn: async () => {
      const res = await api.get<NotificationItem[]>('/notifications');
      return res.data;
    },
    enabled: !!user,
  });

  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const res = await api.get<UnreadCountResponse>('/notifications/unread-count');
      return res.data;
    },
    enabled: !!user,
  });

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read');
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    } catch (err) {
      console.warn('Failed to mark all read', err);
    }
  };

  const handleNotificationPress = async (item: NotificationItem) => {
    if (!item.read) {
      try {
        await api.post(`/notifications/${item.id}/read`);
        queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      } catch (err) {
        console.warn('Failed to mark one read', err);
      }
    }

    // Deep link routing based on notification link or kind
    const link = item.link || '';
    if (link.includes('interested')) {
      router.push('/interested-creators' as any);
    } else if (link.includes('messages')) {
      router.push('/(tabs)/messages');
    } else if (link.includes('deals')) {
      router.push('/(tabs)/deals');
    } else if (link.includes('campaigns')) {
      router.push('/campaigns' as any);
    } else if (link.includes('profile')) {
      router.push('/(tabs)/profile');
    }
  };

  const renderIcon = (kind: string) => {
    switch (kind) {
      case 'message':
        return <MessageCircle size={18} color={PeacockColors.teal} />;
      case 'interest':
        return <Sparkles size={18} color={PeacockColors.gold} />;
      case 'offer':
        return <Briefcase size={18} color={PeacockColors.blue} />;
      case 'delivery':
        return <CheckCircle2 size={18} color={PeacockColors.ok} />;
      case 'review':
        return <Star size={18} color={PeacockColors.gold} />;
      case 'crew':
        return <Clapperboard size={18} color="#B49CF0" />;
      default:
        return <Bell size={18} color={PeacockColors.muted} />;
    }
  };

  const unreadCount = unreadData?.unread || 0;
  const items = notifications || [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: PeacockColors.bg }}
      contentContainerStyle={{ padding: 20, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={PeacockColors.teal}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <View>
          <Text style={{ color: PeacockColors.text, fontSize: 26, fontWeight: '800' }}>
            Notifications
          </Text>
          <Text style={{ color: PeacockColors.muted, fontSize: 13, marginTop: 2 }}>
            {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
          </Text>
        </View>

        {unreadCount > 0 ? (
          <Button
            title="Mark All Read"
            variant="outline"
            icon={<Check size={14} color={PeacockColors.text} />}
            onPress={handleMarkAllRead}
            style={{ paddingVertical: 6, paddingHorizontal: 12 }}
          />
        ) : null}
      </View>

      {/* Loading state */}
      {isLoading ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={PeacockColors.teal} />
          <Text style={{ color: PeacockColors.muted, marginTop: 12, fontSize: 13 }}>
            Loading notifications…
          </Text>
        </View>
      ) : items.length === 0 ? (
        <Card style={{ alignItems: 'center', padding: 36 }}>
          <BellOff size={40} color={PeacockColors.muted} />
          <Text style={{ color: PeacockColors.text, fontSize: 17, fontWeight: '700', marginTop: 14 }}>
            No Notifications
          </Text>
          <Text style={{ color: PeacockColors.muted, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
            When creators apply or brand messages arrive, you will see notifications here.
          </Text>
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handleNotificationPress(item)}
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
            >
              <Card
                elevated
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: 14,
                  backgroundColor: item.read ? PeacockColors.deep : PeacockColors.surface,
                  borderLeftWidth: item.read ? 1 : 3,
                  borderLeftColor: item.read ? PeacockColors.line : PeacockColors.teal,
                }}
              >
                <View
                  style={{
                    height: 38,
                    width: 38,
                    borderRadius: 19,
                    backgroundColor: 'rgba(38, 189, 176, 0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                  }}
                >
                  {renderIcon(item.kind)}
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Text
                      style={{
                        color: PeacockColors.text,
                        fontSize: 14,
                        fontWeight: item.read ? '600' : '800',
                        flex: 1,
                        marginRight: 8,
                      }}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    {!item.read ? (
                      <View style={{ height: 8, width: 8, borderRadius: 4, backgroundColor: PeacockColors.teal }} />
                    ) : null}
                  </View>

                  <Text
                    style={{
                      color: item.read ? PeacockColors.muted : PeacockColors.text,
                      fontSize: 13,
                      lineHeight: 18,
                    }}
                  >
                    {item.body}
                  </Text>

                  <Text style={{ color: PeacockColors.muted, fontSize: 11, marginTop: 6 }}>
                    {new Date(item.created_at).toLocaleDateString()} at{' '}
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
