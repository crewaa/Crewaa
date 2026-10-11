import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Handshake,
  Send,
  User,
} from 'lucide-react-native';
import { api } from '../lib/api';
import { getThread, markRead, sendMessage } from '../lib/messages';
import { useAuth } from '../lib/auth-context';
import { PeacockColors } from '../constants/Colors';
import { DealTerms, MessageOut, ThreadDetail } from '../types';

export default function ChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ interestId?: string; id?: string }>();
  const interestId = Number(params.interestId || params.id);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Track keyboard show/hide to adjust layout and scroll to bottom
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 80);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Poll thread every 4 seconds for live chat updates
  const {
    data: thread,
    isLoading,
    error,
    refetch,
  } = useQuery<ThreadDetail>({
    queryKey: ['chat-thread', interestId],
    queryFn: async () => {
      const data = await getThread(interestId);
      markRead(interestId).catch(() => {});
      return data;
    },
    enabled: Number.isInteger(interestId) && interestId > 0 && !!user,
    refetchInterval: 4000,
  });

  // Query deal terms if available
  const { data: terms } = useQuery<DealTerms | null>({
    queryKey: ['deal-terms', interestId],
    queryFn: async () => {
      try {
        const res = await api.get<DealTerms>(`/deals/${interestId}/terms`);
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: Number.isInteger(interestId) && interestId > 0 && !!user,
  });

  useEffect(() => {
    if (thread?.messages.length) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [thread?.messages.length]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !thread || sending) return;

    setSending(true);
    try {
      const newMsg = await sendMessage(interestId, body);
      setDraft('');
      // Update thread query cache immediately
      queryClient.setQueryData<ThreadDetail>(['chat-thread', interestId], (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, newMsg],
        };
      });
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    } catch {
      // quiet error or retry
    } finally {
      setSending(false);
    }
  };

  const renderMessageItem = ({ item }: { item: MessageOut }) => {
    const isMine = item.is_mine;
    const counterpartAvatar = thread?.counterpart.avatar_url;

    return (
      <View
        style={{
          flexDirection: 'row',
          justifyContent: isMine ? 'flex-end' : 'flex-start',
          alignItems: 'flex-end',
          marginVertical: 4,
          paddingHorizontal: 12,
          gap: 6,
        }}
      >
        {!isMine ? (
          counterpartAvatar ? (
            <Image
              source={{ uri: counterpartAvatar }}
              style={{
                height: 28,
                width: 28,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: PeacockColors.line,
                marginBottom: 2,
              }}
            />
          ) : (
            <View
              style={{
                height: 28,
                width: 28,
                borderRadius: 14,
                backgroundColor: PeacockColors.surface,
                borderWidth: 1,
                borderColor: PeacockColors.line,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 2,
              }}
            >
              <User size={14} color={PeacockColors.teal} />
            </View>
          )
        ) : null}

        <View
          style={{
            maxWidth: '78%',
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 10,
            backgroundColor: isMine ? PeacockColors.teal : PeacockColors.surface,
            borderWidth: isMine ? 0 : 1,
            borderColor: PeacockColors.line,
          }}
        >
          <Text
            style={{
              color: isMine ? PeacockColors.onTeal : PeacockColors.text,
              fontSize: 15,
              lineHeight: 20,
            }}
          >
            {item.body}
          </Text>
          <Text
            style={{
              color: isMine ? 'rgba(255, 255, 255, 0.7)' : PeacockColors.muted,
              fontSize: 10,
              marginTop: 4,
              alignSelf: isMine ? 'flex-end' : 'flex-start',
            }}
          >
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: PeacockColors.bg,
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 16),
        }}
      >
        <ActivityIndicator size="large" color={PeacockColors.teal} />
        <Text style={{ color: PeacockColors.muted, marginTop: 12, fontSize: 14 }}>Loading conversation…</Text>
      </View>
    );
  }

  if (error || !thread) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: PeacockColors.bg,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 24),
        }}
      >
        <Text style={{ color: PeacockColors.danger, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>
          Could not load this conversation.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginTop: 16,
            backgroundColor: PeacockColors.surface,
            paddingVertical: 10,
            paddingHorizontal: 20,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: PeacockColors.line,
          }}
        >
          <Text style={{ color: PeacockColors.text, fontWeight: '600' }}>Back to Messages</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const counterpart = thread.counterpart;
  const isClosed = thread.interest_status === 'withdrawn';
  const activeOffer = terms?.agreed || terms?.current;

  return (
    <View style={{ flex: 1, backgroundColor: PeacockColors.bg }}>
      {/* Header Bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 12,
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: 10,
          backgroundColor: PeacockColors.deep,
          borderBottomWidth: 1,
          borderBottomColor: PeacockColors.line,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ padding: 4 }}
          >
            <ArrowLeft size={22} color={PeacockColors.text} />
          </TouchableOpacity>

          {counterpart.avatar_url ? (
            <Image
              source={{ uri: counterpart.avatar_url }}
              style={{
                height: 38,
                width: 38,
                borderRadius: 19,
                borderWidth: 1.5,
                borderColor: PeacockColors.teal,
              }}
            />
          ) : (
            <View
              style={{
                height: 38,
                width: 38,
                borderRadius: 19,
                backgroundColor: PeacockColors.surface,
                borderWidth: 1.5,
                borderColor: PeacockColors.teal,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <User size={18} color={PeacockColors.teal} />
            </View>
          )}

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: PeacockColors.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
              {counterpart.name}
            </Text>
            {counterpart.subtitle ? (
              <Text style={{ color: PeacockColors.muted, fontSize: 12 }} numberOfLines={1}>
                {counterpart.subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Deal Terms Toggle Button */}
        {terms ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowTerms((v) => !v)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 10,
              backgroundColor: showTerms
                ? PeacockColors.teal
                : terms.agreed
                ? 'rgba(134, 211, 107, 0.15)'
                : 'rgba(38, 189, 176, 0.15)',
              borderWidth: 1,
              borderColor: terms.agreed ? 'rgba(134, 211, 107, 0.4)' : PeacockColors.line,
            }}
          >
            <Handshake size={14} color={showTerms ? PeacockColors.onTeal : terms.agreed ? PeacockColors.ok : PeacockColors.teal} />
            <Text
              style={{
                color: showTerms ? PeacockColors.onTeal : terms.agreed ? PeacockColors.ok : PeacockColors.teal,
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              {terms.agreed ? 'Agreed' : terms.current ? 'Terms' : 'Deal'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Collapsible Deal Terms Drawer */}
      {terms && showTerms && activeOffer ? (
        <View
          style={{
            backgroundColor: PeacockColors.surface,
            padding: 14,
            borderBottomWidth: 1,
            borderBottomColor: PeacockColors.line,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Handshake size={16} color={terms.agreed ? PeacockColors.ok : PeacockColors.teal} />
              <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '700' }}>
                {terms.agreed ? 'Agreed Deal Terms' : 'Current Offer'}
              </Text>
            </View>
            <Text style={{ color: PeacockColors.gold, fontSize: 16, fontWeight: '800' }}>
              {activeOffer.currency === 'INR' ? '₹' : `${activeOffer.currency} `}
              {Number(activeOffer.fee).toLocaleString()}
            </Text>
          </View>

          {activeOffer.deadline ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
              <CalendarDays size={13} color={PeacockColors.muted} />
              <Text style={{ color: PeacockColors.muted, fontSize: 12 }}>
                Deadline: {new Date(activeOffer.deadline).toLocaleDateString()}
              </Text>
            </View>
          ) : null}

          {activeOffer.deliverables && activeOffer.deliverables.length > 0 ? (
            <View style={{ marginTop: 8, gap: 4 }}>
              {activeOffer.deliverables.map((d, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Check size={12} color={PeacockColors.teal} />
                  <Text style={{ color: PeacockColors.text, fontSize: 12 }}>{d}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {activeOffer.note ? (
            <Text style={{ color: PeacockColors.muted, fontSize: 12, fontStyle: 'italic', marginTop: 6 }}>
              &quot;{activeOffer.note}&quot;
            </Text>
          ) : null}
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Messages Feed */}
        <FlatList
          ref={flatListRef}
          data={thread.messages}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMessageItem}
          contentContainerStyle={{ paddingVertical: 12 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }}
          onLayout={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
          ListEmptyComponent={
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <Text style={{ color: PeacockColors.muted, fontSize: 14 }}>
                No messages yet. Say hello to start the conversation!
              </Text>
            </View>
          }
        />

        {/* Input Bar */}
        <View
          style={{
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom, 14),
            backgroundColor: PeacockColors.deep,
            borderTopWidth: 1,
            borderTopColor: PeacockColors.line,
          }}
        >
          {isClosed ? (
            <View style={{ paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ color: PeacockColors.muted, fontSize: 13 }}>
                This thread is closed because the opportunity was withdrawn.
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Write a message…"
                placeholderTextColor={PeacockColors.muted}
                selectionColor={PeacockColors.teal}
                multiline
                maxLength={2000}
                onFocus={() => {
                  setIsKeyboardVisible(true);
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
                style={{
                  flex: 1,
                  backgroundColor: PeacockColors.surface,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: PeacockColors.line,
                  color: PeacockColors.text,
                  paddingHorizontal: 16,
                  paddingTop: 10,
                  paddingBottom: 10,
                  fontSize: 15,
                  maxHeight: 100,
                }}
              />

              <TouchableOpacity
                onPress={handleSend}
                disabled={sending || !draft.trim()}
                style={{
                  height: 42,
                  width: 42,
                  borderRadius: 21,
                  backgroundColor: draft.trim() ? PeacockColors.teal : PeacockColors.surface,
                  borderWidth: 1,
                  borderColor: draft.trim() ? PeacockColors.teal : PeacockColors.line,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: draft.trim() ? 1 : 0.6,
                }}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={PeacockColors.onTeal} />
                ) : (
                  <Send size={18} color={draft.trim() ? PeacockColors.onTeal : PeacockColors.muted} />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
