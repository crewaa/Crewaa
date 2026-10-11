import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeCheck,
  ExternalLink,
  Heart,
  Mail,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Star,
  Tag,
  TrendingUp,
  User,
  Users,
} from 'lucide-react-native';
import { api } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { InstagramIcon, YoutubeIcon } from '../components/icons/SocialIcons';
import { PeacockColors } from '../constants/Colors';
import { CreatorProfileForBrand, PublicReviews } from '../types';

function compact(n?: number | null): string {
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function CreatorProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const creatorId = Number(params.id);
  const [avatarImgError, setAvatarImgError] = useState(false);

  // Query creator details as seen by brand
  const {
    data: creator,
    isLoading,
    error,
    refetch: refetchCreator,
    isRefetching,
  } = useQuery({
    queryKey: ['creator-for-brand', creatorId],
    queryFn: async () => {
      const res = await api.get<CreatorProfileForBrand>(`/ai/creators/${creatorId}`);
      return res.data;
    },
    enabled: Number.isInteger(creatorId) && creatorId > 0,
  });

  // Query public reviews for this creator
  const {
    data: reviewsData,
    refetch: refetchReviews,
  } = useQuery({
    queryKey: ['creator-public-reviews', creatorId],
    queryFn: async () => {
      try {
        const res = await api.get<PublicReviews>(`/deals/reviews/user/${creatorId}`);
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: Number.isInteger(creatorId) && creatorId > 0,
  });

  const onRefresh = async () => {
    await Promise.all([refetchCreator(), refetchReviews()]);
  };

  const openInstagram = async (username?: string | null) => {
    if (!username) return;
    const trimmed = username.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        await Linking.openURL(trimmed);
        return;
      } catch {
        // continue to app scheme
      }
    }
    const clean = trimmed
      .replace(/^@/, '')
      .replace(/^https?:\/\/(www\.)?instagram\.com\//, '')
      .replace(/\/$/, '');
    const appUrl = `instagram://user?username=${clean}`;
    const webUrl = `https://instagram.com/${clean}`;
    try {
      const can = await Linking.canOpenURL(appUrl);
      if (can) {
        await Linking.openURL(appUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch {
      await Linking.openURL(webUrl);
    }
  };

  const openYouTube = async (usernameOrUrl?: string | null) => {
    if (!usernameOrUrl) return;
    const clean = usernameOrUrl.trim();
    let url = clean;
    if (!clean.startsWith('http')) {
      const handle = clean.startsWith('@') ? clean : `@${clean}`;
      url = `https://youtube.com/${handle}`;
    }
    try {
      await Linking.openURL(url);
    } catch {
      // fallback
    }
  };

  if (!Number.isInteger(creatorId) || creatorId <= 0) {
    return (
      <View style={{ flex: 1, backgroundColor: PeacockColors.bg, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Card elevated style={{ alignItems: 'center', padding: 24, maxWidth: 400, width: '100%' }}>
          <Text style={{ color: PeacockColors.text, fontSize: 17, fontWeight: '700' }}>
            Invalid Creator Link
          </Text>
          <Text style={{ color: PeacockColors.muted, fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 20 }}>
            The requested creator profile could not be found.
          </Text>
          <Button title="Go Back" variant="outline" onPress={() => router.back()} />
        </Card>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: PeacockColors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={PeacockColors.teal} />
        <Text style={{ color: PeacockColors.muted, marginTop: 14, fontSize: 13 }}>
          Loading creator profile…
        </Text>
      </View>
    );
  }

  if (error || !creator) {
    return (
      <View style={{ flex: 1, backgroundColor: PeacockColors.bg, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Card elevated style={{ alignItems: 'center', padding: 24, maxWidth: 400, width: '100%' }}>
          <Text style={{ color: PeacockColors.danger, fontSize: 17, fontWeight: '700' }}>
            Unable to Load Profile
          </Text>
          <Text style={{ color: PeacockColors.muted, fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 20 }}>
            Could not fetch this creator's public profile data.
          </Text>
          <Button title="Try Again" variant="primary" onPress={() => refetchCreator()} />
        </Card>
      </View>
    );
  }

  const reviews = reviewsData?.reviews || [];
  const brandReviews = reviews.filter((r) => r.author_role === 'brand');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: PeacockColors.bg }}
      contentContainerStyle={{ padding: 20, paddingBottom: 64, maxWidth: 640, width: '100%', alignSelf: 'center' }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          tintColor={PeacockColors.teal}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Creator Identity Header Card */}
      <Card elevated style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
          {/* Avatar Ring */}
          {(creator.profile_picture || creator.avatar_url) && !avatarImgError ? (
            <Image
              source={{ uri: (creator.profile_picture || creator.avatar_url)! }}
              style={{
                height: 72,
                width: 72,
                borderRadius: 36,
                borderWidth: 2,
                borderColor: PeacockColors.teal,
                backgroundColor: PeacockColors.surface,
              }}
              resizeMode="cover"
              onError={() => setAvatarImgError(true)}
            />
          ) : (
            <View
              style={{
                height: 72,
                width: 72,
                borderRadius: 36,
                backgroundColor: PeacockColors.surface,
                borderWidth: 2,
                borderColor: PeacockColors.teal,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <User size={36} color={PeacockColors.teal} />
            </View>
          )}

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text
                style={{
                  color: PeacockColors.text,
                  fontSize: 22,
                  fontWeight: '800',
                  letterSpacing: -0.3,
                }}
              >
                {creator.creator_name || 'Creator'}
              </Text>
              {creator.is_verified ? (
                <BadgeCheck size={20} color={PeacockColors.blue} />
              ) : null}
            </View>

            <Text style={{ color: PeacockColors.muted, fontSize: 13, marginTop: 2 }}>
              {[creator.category, creator.primary_platform].filter(Boolean).join(' • ') || 'Content Creator'}
            </Text>

            {creator.location ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <MapPin size={13} color={PeacockColors.muted} />
                <Text style={{ color: PeacockColors.muted, fontSize: 12 }}>
                  {creator.location}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Bio */}
        {creator.bio ? (
          <Text style={{ color: PeacockColors.text, fontSize: 14, lineHeight: 21, marginTop: 14 }}>
            {creator.bio}
          </Text>
        ) : null}

        {/* Social Direct Navigation Actions */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
          {creator.instagram_username ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => openInstagram(creator.instagram_username)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: PeacockColors.deep,
                borderWidth: 1,
                borderColor: 'rgba(225, 48, 108, 0.35)',
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                flexGrow: 1,
                justifyContent: 'center',
              }}
            >
              <InstagramIcon size={16} color="#E1306C" />
              <Text style={{ color: PeacockColors.text, fontSize: 13, fontWeight: '700' }}>
                @{creator.instagram_username}
              </Text>
              <ExternalLink size={13} color={PeacockColors.muted} />
            </TouchableOpacity>
          ) : null}

          {creator.youtube_username || creator.youtube_url ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => openYouTube(creator.youtube_url || creator.youtube_username)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: PeacockColors.deep,
                borderWidth: 1,
                borderColor: 'rgba(255, 0, 0, 0.35)',
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                flexGrow: 1,
                justifyContent: 'center',
              }}
            >
              <YoutubeIcon size={16} color="#FF0000" />
              <Text style={{ color: PeacockColors.text, fontSize: 13, fontWeight: '700' }}>
                {creator.youtube_username || 'YouTube Channel'}
              </Text>
              <ExternalLink size={13} color={PeacockColors.muted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </Card>

      {/* Performance Metrics Tiles */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: PeacockColors.surface,
            borderRadius: 14,
            padding: 12,
            borderWidth: 1,
            borderColor: PeacockColors.line,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: PeacockColors.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' }}>
            {creator.subscribers != null && creator.followers == null ? 'Subscribers' : 'Followers'}
          </Text>
          <Text style={{ color: PeacockColors.teal, fontSize: 19, fontWeight: '800', marginTop: 4 }}>
            {creator.subscribers != null && creator.followers == null
              ? compact(creator.subscribers)
              : compact(creator.followers)}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            backgroundColor: PeacockColors.surface,
            borderRadius: 14,
            padding: 12,
            borderWidth: 1,
            borderColor: PeacockColors.line,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: PeacockColors.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' }}>
            Engagement
          </Text>
          <Text style={{ color: PeacockColors.ok, fontSize: 19, fontWeight: '800', marginTop: 4 }}>
            {creator.engagement_rate != null ? `${creator.engagement_rate.toFixed(1)}%` : '—'}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            backgroundColor: PeacockColors.surface,
            borderRadius: 14,
            padding: 12,
            borderWidth: 1,
            borderColor: PeacockColors.line,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: PeacockColors.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' }}>
            Avg Likes
          </Text>
          <Text style={{ color: '#E1306C', fontSize: 19, fontWeight: '800', marginTop: 4 }}>
            {compact(creator.avg_likes)}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            backgroundColor: PeacockColors.surface,
            borderRadius: 14,
            padding: 12,
            borderWidth: 1,
            borderColor: PeacockColors.line,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: PeacockColors.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' }}>
            Avg Comments
          </Text>
          <Text style={{ color: PeacockColors.blue, fontSize: 19, fontWeight: '800', marginTop: 4 }}>
            {compact(creator.avg_comments)}
          </Text>
        </View>
      </View>

      {/* Authenticity Score Breakdown Card */}
      <Card elevated style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={22} color={PeacockColors.teal} />
            <Text style={{ color: PeacockColors.text, fontSize: 17, fontWeight: '700' }}>
              Authenticity Verified
            </Text>
          </View>
          {creator.authenticity ? (
            <Badge
              label={creator.authenticity.level.toUpperCase()}
              variant={creator.authenticity.level === 'high' ? 'ok' : 'gold'}
            />
          ) : null}
        </View>

        <Text style={{ color: PeacockColors.muted, fontSize: 13, lineHeight: 19 }}>
          Signals evaluated against authentic human engagement benchmarks, comment quality, and audience retention metrics.
        </Text>

        {creator.authenticity?.score != null ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(38, 189, 176, 0.1)',
              borderColor: 'rgba(38, 189, 176, 0.3)',
              borderWidth: 1,
              borderRadius: 12,
              padding: 12,
              marginTop: 12,
            }}
          >
            <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '600' }}>
              Authenticity Score
            </Text>
            <Text style={{ color: PeacockColors.teal, fontSize: 20, fontWeight: '800' }}>
              {creator.authenticity.score} / 100
            </Text>
          </View>
        ) : null}
      </Card>

      {/* Brand Reviews Section */}
      <Card elevated style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: PeacockColors.text, fontSize: 17, fontWeight: '700' }}>
            Brand Reviews
          </Text>
          {reviewsData && reviewsData.review_count > 0 && reviewsData.average_rating != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Star size={15} color={PeacockColors.gold} fill={PeacockColors.gold} />
              <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '700' }}>
                {reviewsData.average_rating.toFixed(1)}
              </Text>
              <Text style={{ color: PeacockColors.muted, fontSize: 12 }}>
                ({reviewsData.review_count})
              </Text>
            </View>
          ) : null}
        </View>

        {brandReviews.length === 0 ? (
          <View style={{ paddingVertical: 12 }}>
            <Text style={{ color: PeacockColors.muted, fontSize: 13, lineHeight: 19 }}>
              No reviews from brands yet. Verified ratings and feedback appear here once campaigns complete.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {brandReviews.slice(0, 5).map((review) => (
              <View
                key={review.id}
                style={{
                  borderTopWidth: 1,
                  borderTopColor: PeacockColors.line,
                  paddingTop: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', gap: 3 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={13}
                        color={star <= review.rating ? PeacockColors.gold : '#334155'}
                        fill={star <= review.rating ? PeacockColors.gold : 'transparent'}
                      />
                    ))}
                  </View>
                  <Text style={{ color: PeacockColors.muted, fontSize: 11 }}>
                    {new Date(review.created_at).toLocaleDateString()}
                  </Text>
                </View>
                {review.comment ? (
                  <Text style={{ color: PeacockColors.text, fontSize: 13, marginTop: 6, lineHeight: 18 }}>
                    {review.comment}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Action Footer */}
      <View style={{ gap: 10 }}>
        <Button
          title="Open Conversation / Negotiate"
          variant="primary"
          icon={<MessageCircle size={16} color={PeacockColors.onTeal} />}
          onPress={() => router.push('/(tabs)/messages')}
        />
      </View>
    </ScrollView>
  );
}
