import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LogIn, MessageCircle, User } from 'lucide-react-native';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PeacockColors } from '../../constants/Colors';
import { ThreadSummary } from '../../types';

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const {
    data: threads,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['message-threads'],
    queryFn: async () => {
      const res = await api.get<ThreadSummary[]>('/messages/threads');
      return res.data;
    },
    enabled: !!user,
  });

  if (!user) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: PeacockColors.bg,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Card elevated style={{ alignItems: 'center', padding: 24, maxWidth: 400, width: '100%' }}>
          <MessageCircle size={40} color={PeacockColors.teal} />
          <Text style={{ color: PeacockColors.text, fontSize: 20, fontWeight: '700', marginTop: 16 }}>
            Authentication Required
          </Text>
          <Text style={{ color: PeacockColors.muted, fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 20 }}>
            Sign in to view and respond to your messages and deal negotiations.
          </Text>
          <Button
            title="Sign In"
            variant="primary"
            icon={<LogIn size={18} color={PeacockColors.onTeal} />}
            onPress={() => router.push('/(auth)/login')}
            style={{ width: '100%' }}
          />
        </Card>
      </View>
    );
  }

  const renderThreadItem = ({ item }: { item: ThreadSummary }) => (
    <Pressable
      onPress={() => router.push('/modal')}
      style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
    >
      <Card style={{ marginBottom: 14, flexDirection: 'row', alignItems: 'center', padding: 16 }}>
        {/* Avatar */}
        <View
          style={{
            height: 48,
            width: 48,
            borderRadius: 24,
            backgroundColor: PeacockColors.raised,
            borderWidth: 1,
            borderColor: PeacockColors.line,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 14,
          }}
        >
          <User size={22} color={PeacockColors.teal} />
        </View>

        {/* Content */}
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: PeacockColors.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
              {item.counterpart.name}
            </Text>
            {item.last_message_at ? (
              <Text style={{ color: PeacockColors.muted, fontSize: 12 }}>
                {new Date(item.last_message_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            ) : null}
          </View>

          <Text
            style={{ color: PeacockColors.muted, fontSize: 14 }}
            numberOfLines={1}
          >
            {item.last_message || 'No messages yet. Tap to start chatting.'}
          </Text>
        </View>

        {/* Unread badge */}
        {item.unread_count > 0 ? (
          <View
            style={{
              height: 22,
              minWidth: 22,
              borderRadius: 11,
              backgroundColor: PeacockColors.teal,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 6,
            }}
          >
            <Text style={{ color: PeacockColors.onTeal, fontSize: 11, fontWeight: '800' }}>
              {item.unread_count}
            </Text>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: PeacockColors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={PeacockColors.teal} />
        <Text style={{ color: PeacockColors.muted, marginTop: 12, fontSize: 14 }}>Loading messages…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: PeacockColors.bg, paddingHorizontal: 16, paddingTop: 12 }}>
      <FlatList
        data={threads || []}
        keyExtractor={(item) => String(item.interest_id)}
        renderItem={renderThreadItem}
        contentContainerStyle={{ maxWidth: 640, width: '100%', alignSelf: 'center', paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={PeacockColors.teal}
          />
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 64 }}>
            <MessageCircle size={38} color={PeacockColors.muted} />
            <Text style={{ color: PeacockColors.text, fontSize: 16, fontWeight: '600', marginTop: 14 }}>
              No conversations yet
            </Text>
            <Text style={{ color: PeacockColors.muted, fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 }}>
              When a creator expresses interest or you connect on an opportunity, your conversation appears here.
            </Text>
          </View>
        }
      />
    </View>
  );
}
