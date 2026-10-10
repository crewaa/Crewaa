import React, { useEffect, useState } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Inbox,
  Mail,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Tag,
  TrendingUp,
  User,
  Users,
} from 'lucide-react-native';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Card } from '../components/ui/Card';
import { Badge, BadgeVariant } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { InstagramIcon, YoutubeIcon } from '../components/icons/SocialIcons';
import { PeacockColors } from '../constants/Colors';
import { InterestedCreator, InterestedCreatorsResponse } from '../types';

export default function InterestedCreatorsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['interested-creators'],
    queryFn: async () => {
      const res = await api.get<InterestedCreatorsResponse>('/ai/interested-creators');
      return res.data;
    },
    enabled: !!user && user?.role === 'BRAND',
  });

  const creators = data?.creators || [];

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
      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: PeacockColors.text, fontSize: 26, fontWeight: '800' }}>
          Interested Creators
        </Text>
        <Text style={{ color: PeacockColors.muted, fontSize: 14, marginTop: 4 }}>
          Creators who responded to your campaigns with custom pitches and verified credentials.
        </Text>
      </View>

      {/* Summary Counter */}
      <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              height: 38,
              width: 38,
              borderRadius: 19,
              backgroundColor: 'rgba(38, 189, 176, 0.15)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={20} color={PeacockColors.teal} />
          </View>
          <View>
            <Text style={{ color: PeacockColors.text, fontSize: 16, fontWeight: '700' }}>
              {creators.length} Inbound Applications
            </Text>
            <Text style={{ color: PeacockColors.muted, fontSize: 12 }}>
              Ready for review and deal negotiation
            </Text>
          </View>
        </View>
        <Badge label="Active" variant="ok" />
      </Card>

      {/* Loading state */}
      {isLoading ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={PeacockColors.teal} />
          <Text style={{ color: PeacockColors.muted, marginTop: 12, fontSize: 13 }}>
            Loading creator responses…
          </Text>
        </View>
      ) : creators.length === 0 ? (
        <Card style={{ alignItems: 'center', padding: 36 }}>
          <Inbox size={42} color={PeacockColors.muted} />
          <Text style={{ color: PeacockColors.text, fontSize: 17, fontWeight: '700', marginTop: 14 }}>
            No Responses Yet
          </Text>
          <Text style={{ color: PeacockColors.muted, fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 20 }}>
            Make sure your campaigns are active, or create a new campaign so creators can discover and apply for it.
          </Text>
          <Button
            title="Manage Campaigns"
            variant="primary"
            onPress={() => router.push('/campaigns' as any)}
          />
        </Card>
      ) : (
        <View style={{ gap: 14 }}>
          {creators.map((item) => (
            <Card key={item.interest_id} elevated style={{ gap: 12 }}>
              {/* Creator Top Row */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ color: PeacockColors.text, fontSize: 18, fontWeight: '700' }}>
                    {item.creator_name || 'Creator'}
                  </Text>
                  <Text style={{ color: PeacockColors.muted, fontSize: 12, marginTop: 2 }}>
                    {item.category || 'Creator'} • {item.location || 'India'}
                  </Text>
                </View>

                {item.authenticity?.score != null ? (
                  <Badge
                    label={`Score: ${item.authenticity.score}`}
                    variant={item.authenticity.level === 'high' ? 'ok' : 'gold'}
                  />
                ) : null}
              </View>

              {/* Handles & Email */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {item.instagram_username ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: PeacockColors.deep, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                    <InstagramIcon size={12} color="#E1306C" />
                    <Text style={{ color: PeacockColors.text, fontSize: 11 }}>@{item.instagram_username}</Text>
                  </View>
                ) : null}

                {item.youtube_username ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: PeacockColors.deep, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                    <YoutubeIcon size={12} color="#FF0000" />
                    <Text style={{ color: PeacockColors.text, fontSize: 11 }}>{item.youtube_username}</Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: PeacockColors.deep, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                  <Mail size={12} color={PeacockColors.muted} />
                  <Text style={{ color: PeacockColors.muted, fontSize: 11 }}>{item.email}</Text>
                </View>
              </View>

              {/* Stats Bar */}
              <View style={{ flexDirection: 'row', backgroundColor: PeacockColors.deep, borderRadius: 10, padding: 10, justifyContent: 'space-around' }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: PeacockColors.muted, fontSize: 10, fontWeight: '600' }}>Followers</Text>
                  <Text style={{ color: PeacockColors.teal, fontSize: 14, fontWeight: '800', marginTop: 2 }}>
                    {item.followers ? (item.followers >= 1000 ? `${(item.followers / 1000).toFixed(1)}K` : item.followers) : '–'}
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: PeacockColors.muted, fontSize: 10, fontWeight: '600' }}>Engagement</Text>
                  <Text style={{ color: PeacockColors.ok, fontSize: 14, fontWeight: '800', marginTop: 2 }}>
                    {item.engagement_rate != null ? `${item.engagement_rate.toFixed(1)}%` : '–'}
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: PeacockColors.muted, fontSize: 10, fontWeight: '600' }}>Applied For</Text>
                  <Text style={{ color: PeacockColors.gold, fontSize: 14, fontWeight: '800', marginTop: 2 }}>
                    {item.campaign_type || 'Collaboration'}
                  </Text>
                </View>
              </View>

              {/* Message from Creator */}
              {item.message ? (
                <View style={{ backgroundColor: 'rgba(38, 189, 176, 0.08)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(38, 189, 176, 0.2)' }}>
                  <Text style={{ color: PeacockColors.teal, fontSize: 11, fontWeight: '700', marginBottom: 2 }}>
                    Pitch Message
                  </Text>
                  <Text style={{ color: PeacockColors.text, fontSize: 13, lineHeight: 18 }}>
                    &quot;{item.message}&quot;
                  </Text>
                </View>
              ) : null}

              {/* Applied Date & Chat Button */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ color: PeacockColors.muted, fontSize: 11 }}>
                  Applied {new Date(item.created_at).toLocaleDateString()}
                </Text>
                <Button
                  title="Message / Negotiate"
                  variant="primary"
                  icon={<MessageCircle size={14} color={PeacockColors.onTeal} />}
                  onPress={() => router.push('/(tabs)/messages')}
                  style={{ paddingVertical: 8, paddingHorizontal: 14 }}
                />
              </View>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
