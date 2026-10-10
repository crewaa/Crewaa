import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Edit,
  Eye,
  Heart,
  HelpCircle,
  MessageCircle,
  MinusCircle,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
  Video,
  XCircle,
} from 'lucide-react-native';
import { InstagramIcon, YoutubeIcon } from '../components/icons/SocialIcons';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PeacockColors } from '../constants/Colors';
import {
  AuthenticityLevel,
  AuthenticityReportResponse,
  InstagramAnalyticsResponse,
  InstagramPost,
  ScrapeStatus,
  SignalStatus,
  YouTubeAnalyticsResponse,
  YouTubeVideo,
} from '../types';

const LEVEL_COPY: Record<
  AuthenticityLevel,
  { label: string; color: string; bg: string }
> = {
  high: {
    label: 'High Authenticity',
    color: PeacockColors.ok,
    bg: 'rgba(134, 211, 107, 0.15)',
  },
  medium: {
    label: 'Some Concerns',
    color: PeacockColors.gold,
    bg: 'rgba(216, 180, 90, 0.15)',
  },
  low: {
    label: 'Low Authenticity',
    color: PeacockColors.danger,
    bg: 'rgba(242, 113, 107, 0.15)',
  },
  insufficient: {
    label: 'Not Enough Data Yet',
    color: PeacockColors.muted,
    bg: 'rgba(143, 176, 176, 0.15)',
  },
};

export default function AnalyticsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activePlatform, setActivePlatform] = useState<'instagram' | 'youtube'>('instagram');
  const [scraping, setScraping] = useState(false);
  const [scrapeMessage, setScrapeMessage] = useState<string | null>(null);
  const [igImgError, setIgImgError] = useState(false);
  const [ytImgError, setYtImgError] = useState(false);

  const userId = user?.id;

  // Authenticity report query
  const {
    data: authenticityData,
    isLoading: authLoading,
    refetch: refetchAuth,
  } = useQuery({
    queryKey: ['authenticity', userId],
    queryFn: async () => {
      const res = await api.get<AuthenticityReportResponse>(`/authenticity/${userId}`);
      return res.data;
    },
    enabled: !!userId,
  });

  // Instagram analytics query
  const {
    data: igData,
    isLoading: igLoading,
    refetch: refetchIg,
    isRefetching: igRefetching,
  } = useQuery({
    queryKey: ['ig-analytics', userId],
    queryFn: async () => {
      const res = await api.get<InstagramAnalyticsResponse>(`/instagram/analytics/${userId}`);
      return res.data;
    },
    enabled: !!userId,
  });

  // YouTube analytics query
  const {
    data: ytData,
    isLoading: ytLoading,
    refetch: refetchYt,
    isRefetching: ytRefetching,
  } = useQuery({
    queryKey: ['yt-analytics', userId],
    queryFn: async () => {
      const res = await api.get<YouTubeAnalyticsResponse>(`/youtube/analytics/${userId}`);
      return res.data;
    },
    enabled: !!userId,
  });

  // Manual Trigger Scrape & Status Polling
  const handleTriggerScrape = async () => {
    if (!userId || scraping) return;
    setScraping(true);
    setScrapeMessage(`Starting ${activePlatform === 'instagram' ? 'Instagram' : 'YouTube'} scrape…`);

    try {
      if (activePlatform === 'instagram') {
        await api.post(`/instagram/scrape/${userId}`);
      } else {
        await api.post(`/youtube/scrape/${userId}`);
      }

      // Poll status every 3s up to 30 attempts (~90s)
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const statusEndpoint =
            activePlatform === 'instagram'
              ? `/instagram/scrape-status/${userId}`
              : `/youtube/scrape-status/${userId}`;

          const res = await api.get<ScrapeStatus>(statusEndpoint);
          const job = res.data;

          if (job.status === 'success') {
            clearInterval(interval);
            setScraping(false);
            setScrapeMessage('Scrape completed! Updating stats…');
            setTimeout(() => setScrapeMessage(null), 3000);
            if (activePlatform === 'instagram') refetchIg();
            else refetchYt();
            refetchAuth();
          } else if (job.status === 'error') {
            clearInterval(interval);
            setScraping(false);
            setScrapeMessage(job.message || 'Scrape failed. Please verify your handle.');
            setTimeout(() => setScrapeMessage(null), 4000);
          } else {
            setScrapeMessage(`Scraping in progress… (${attempts * 3}s)`);
          }

          if (attempts >= 30) {
            clearInterval(interval);
            setScraping(false);
            setScrapeMessage('Scraping took longer than expected. Pull down to refresh later.');
          }
        } catch {
          clearInterval(interval);
          setScraping(false);
          setScrapeMessage(null);
        }
      }, 3000);
    } catch (err: any) {
      setScraping(false);
      setScrapeMessage(err?.detail || err?.message || 'Failed to start scrape.');
      setTimeout(() => setScrapeMessage(null), 3000);
    }
  };

  const currentReport = authenticityData?.reports?.find(
    (r) => r.platform === activePlatform
  );

  const levelInfo = currentReport
    ? LEVEL_COPY[currentReport.level]
    : LEVEL_COPY.insufficient;

  // Instagram metrics calculation
  const igStats = useMemo(() => {
    if (!igData?.profile) return null;
    const posts = igData.posts || [];
    const postCount = posts.length;
    const followers = igData.profile.followers || 0;
    const following = igData.profile.following || 0;
    const postsCount = igData.profile.posts_count || 0;

    if (postCount === 0) {
      return {
        followers,
        following,
        postsCount,
        avgLikes: 0,
        avgComments: 0,
        engagementRate: '0.00',
      };
    }

    const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = posts.reduce((sum, p) => sum + (p.comments || 0), 0);
    const avgLikes = Math.round(totalLikes / postCount);
    const avgComments = Math.round(totalComments / postCount);

    const engagementRate =
      followers > 0
        ? (((totalLikes + totalComments) / (followers * postCount)) * 100).toFixed(2)
        : '0.00';

    return {
      followers,
      following,
      postsCount,
      avgLikes,
      avgComments,
      engagementRate,
    };
  }, [igData]);

  // YouTube metrics calculation
  const ytStats = useMemo(() => {
    if (!ytData?.channel) return null;
    const videos = ytData.videos || [];
    const videoCount = videos.length;
    const subscribers = ytData.channel.subscribers || 0;
    const totalChannelViews = ytData.channel.total_views || 0;
    const totalVideos = ytData.channel.total_videos ?? ytData.channel.video_count ?? 0;

    if (videoCount === 0) {
      return {
        subscribers,
        totalChannelViews,
        totalVideos,
        avgViews: 0,
        avgLikes: 0,
        avgComments: 0,
        engagementRate: '0.00',
      };
    }

    const totalSampleViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
    const totalSampleLikes = videos.reduce((sum, v) => sum + (v.likes || 0), 0);
    const totalSampleComments = videos.reduce((sum, v) => sum + (v.comments || 0), 0);

    const avgViews = Math.round(totalSampleViews / videoCount);
    const avgLikes = Math.round(totalSampleLikes / videoCount);
    const avgComments = Math.round(totalSampleComments / videoCount);

    const engagementRate =
      totalSampleViews > 0
        ? ((totalSampleLikes / totalSampleViews) * 100).toFixed(2)
        : '0.00';

    return {
      subscribers,
      totalChannelViews,
      totalVideos,
      avgViews,
      avgLikes,
      avgComments,
      engagementRate,
    };
  }, [ytData]);

  const renderSignalIcon = (status: SignalStatus) => {
    switch (status) {
      case 'good':
        return <CheckCircle2 size={16} color={PeacockColors.ok} />;
      case 'warn':
        return <AlertTriangle size={16} color={PeacockColors.gold} />;
      case 'bad':
        return <XCircle size={16} color={PeacockColors.danger} />;
      default:
        return <MinusCircle size={16} color={PeacockColors.muted} />;
    }
  };

  const isCurrentRefetching =
    activePlatform === 'instagram' ? igRefetching : ytRefetching;

  const handleRefreshAll = () => {
    refetchAuth();
    if (activePlatform === 'instagram') refetchIg();
    else refetchYt();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: PeacockColors.bg }}
      contentContainerStyle={{
        padding: 20,
        paddingBottom: 48,
        maxWidth: 640,
        width: '100%',
        alignSelf: 'center',
      }}
      refreshControl={
        <RefreshControl
          refreshing={isCurrentRefetching}
          onRefresh={handleRefreshAll}
          tintColor={PeacockColors.teal}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ color: PeacockColors.text, fontSize: 26, fontWeight: '800' }}>
            Social Analytics
          </Text>
          <Button
            title="Edit Profile"
            variant="outline"
            icon={<Edit size={14} color={PeacockColors.text} />}
            onPress={() => router.push('/profile-edit' as any)}
            style={{ paddingVertical: 8, paddingHorizontal: 12 }}
          />
        </View>
        <Text style={{ color: PeacockColors.muted, fontSize: 14 }}>
          Public audience stats and AI Authenticity verification.
        </Text>
      </View>

      {/* Platform Switcher */}
      <View
        style={{
          flexDirection: 'row',
          borderRadius: 14,
          backgroundColor: PeacockColors.deep,
          padding: 4,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: PeacockColors.line,
        }}
      >
        <Pressable
          onPress={() => setActivePlatform('instagram')}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor:
              activePlatform === 'instagram' ? PeacockColors.surface : 'transparent',
            gap: 8,
          }}
        >
          <InstagramIcon
            size={18}
            color={activePlatform === 'instagram' ? '#E1306C' : PeacockColors.muted}
          />
          <Text
            style={{
              color: activePlatform === 'instagram' ? PeacockColors.text : PeacockColors.muted,
              fontSize: 14,
              fontWeight: '700',
            }}
          >
            Instagram
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActivePlatform('youtube')}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor:
              activePlatform === 'youtube' ? PeacockColors.surface : 'transparent',
            gap: 8,
          }}
        >
          <YoutubeIcon
            size={18}
            color={activePlatform === 'youtube' ? '#FF0000' : PeacockColors.muted}
          />
          <Text
            style={{
              color: activePlatform === 'youtube' ? PeacockColors.text : PeacockColors.muted,
              fontSize: 14,
              fontWeight: '700',
            }}
          >
            YouTube
          </Text>
        </Pressable>
      </View>

      {/* Scrape Banner / Action */}
      <Card elevated style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ color: PeacockColors.text, fontSize: 16, fontWeight: '700' }}>
              Data Freshness
            </Text>
            <Text style={{ color: PeacockColors.muted, fontSize: 12, marginTop: 2 }}>
              {activePlatform === 'instagram'
                ? igData?.profile?.scraped_at
                  ? `Last imported ${new Date(igData.profile.scraped_at).toLocaleDateString()}`
                  : 'No Instagram data yet'
                : ytData?.channel?.scraped_at
                ? `Last imported ${new Date(ytData.channel.scraped_at).toLocaleDateString()}`
                : 'No YouTube data yet'}
            </Text>
          </View>

          <Button
            title={scraping ? 'Syncing…' : 'Sync Stats'}
            variant="primary"
            loading={scraping}
            icon={!scraping ? <RefreshCw size={14} color={PeacockColors.onTeal} /> : undefined}
            onPress={handleTriggerScrape}
            style={{ paddingVertical: 8, paddingHorizontal: 14 }}
          />
        </View>

        {scrapeMessage ? (
          <View
            style={{
              backgroundColor: 'rgba(38, 189, 176, 0.1)',
              borderColor: 'rgba(38, 189, 176, 0.3)',
              borderWidth: 1,
              borderRadius: 10,
              padding: 10,
              marginTop: 12,
            }}
          >
            <Text style={{ color: PeacockColors.teal, fontSize: 12, fontWeight: '500' }}>
              {scrapeMessage}
            </Text>
          </View>
        ) : null}
      </Card>

      {/* ================= AUTHENTICITY SCORE CARD ================= */}
      <Card elevated style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <ShieldCheck size={22} color={PeacockColors.teal} />
          <Text style={{ color: PeacockColors.text, fontSize: 18, fontWeight: '700' }}>
            Authenticity Score
          </Text>
        </View>

        {/* Score & Verdict Banner */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: levelInfo.bg,
            borderWidth: 1,
            borderColor: levelInfo.color,
            borderRadius: 16,
            padding: 16,
            gap: 16,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              height: 58,
              width: 58,
              borderRadius: 29,
              borderWidth: 3,
              borderColor: levelInfo.color,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: PeacockColors.deep,
            }}
          >
            <Text style={{ color: PeacockColors.text, fontSize: 22, fontWeight: '800' }}>
              {currentReport?.score != null ? currentReport.score : '–'}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: levelInfo.color, fontSize: 16, fontWeight: '700' }}>
              {levelInfo.label}
            </Text>
            <Text style={{ color: PeacockColors.muted, fontSize: 12, marginTop: 2 }}>
              {currentReport
                ? `Computed on ${new Date(currentReport.computed_at).toLocaleDateString()}`
                : 'Scrape your profile to compute score'}
            </Text>
          </View>
        </View>

        {/* Signals List */}
        {currentReport?.signals && currentReport.signals.length > 0 ? (
          <View style={{ gap: 10, marginBottom: 14 }}>
            <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '700', marginBottom: 2 }}>
              Verified Signals
            </Text>
            {currentReport.signals.map((sig) => (
              <View
                key={sig.key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  backgroundColor: PeacockColors.deep,
                  borderRadius: 12,
                  padding: 12,
                  gap: 12,
                  borderWidth: 1,
                  borderColor: PeacockColors.line,
                  width: '100%',
                  overflow: 'hidden',
                }}
              >
                <View style={{ marginTop: 2, flexShrink: 0 }}>
                  {renderSignalIcon(sig.status)}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: PeacockColors.text,
                        fontSize: 13,
                        fontWeight: '700',
                        flexShrink: 1,
                      }}
                    >
                      {sig.label}
                    </Text>
                    {sig.value ? (
                      <View
                        style={{
                          backgroundColor: 'rgba(216, 180, 90, 0.15)',
                          borderWidth: 1,
                          borderColor: 'rgba(216, 180, 90, 0.3)',
                          borderRadius: 6,
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          alignSelf: 'flex-start',
                        }}
                      >
                        <Text
                          style={{
                            color: PeacockColors.gold,
                            fontSize: 11,
                            fontWeight: '700',
                          }}
                        >
                          {sig.value}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={{
                      color: PeacockColors.muted,
                      fontSize: 12,
                      lineHeight: 18,
                      flexShrink: 1,
                    }}
                  >
                    {sig.detail}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: PeacockColors.muted, fontSize: 13, marginBottom: 12 }}>
            No signals calculated yet. Link your handle and tap &quot;Sync Stats&quot;.
          </Text>
        )}

        <Text style={{ color: PeacockColors.muted, fontSize: 10, lineHeight: 14, fontStyle: 'italic' }}>
          Disclaimer: Authenticity scores are algorithmic estimates based on public activity patterns. Not a verdict of fraud.
        </Text>
      </Card>

      {/* ================= PLATFORM METRICS ================= */}
      {activePlatform === 'instagram' ? (
        /* INSTAGRAM METRICS */
        <View style={{ gap: 16 }}>
          <Text style={{ color: PeacockColors.text, fontSize: 18, fontWeight: '700' }}>
            Instagram Performance
          </Text>

          {igData?.profile ? (
            <>
              {/* Profile Bar */}
              <Card elevated style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {igData.profile.profile_picture && !igImgError ? (
                  <View style={{ position: 'relative' }}>
                    <Image
                      source={{ uri: igData.profile.profile_picture }}
                      style={{
                        height: 58,
                        width: 58,
                        borderRadius: 29,
                        borderWidth: 2,
                        borderColor: '#E1306C',
                        backgroundColor: PeacockColors.deep,
                      }}
                      resizeMode="cover"
                      onError={() => setIgImgError(true)}
                    />
                    <View
                      style={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        backgroundColor: '#E1306C',
                        borderRadius: 10,
                        padding: 3,
                        borderWidth: 2,
                        borderColor: PeacockColors.surface,
                      }}
                    >
                      <InstagramIcon size={10} color="#FFFFFF" />
                    </View>
                  </View>
                ) : (
                  <View
                    style={{
                      height: 58,
                      width: 58,
                      borderRadius: 29,
                      backgroundColor: 'rgba(225, 48, 108, 0.15)',
                      borderWidth: 2,
                      borderColor: '#E1306C',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <InstagramIcon size={28} color="#E1306C" />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: PeacockColors.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
                    @{igData.profile.username}
                  </Text>
                  <Text style={{ color: PeacockColors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                    {igData.profile.full_name || 'Instagram Creator'}
                  </Text>
                  {igData.profile.bio ? (
                    <Text style={{ color: PeacockColors.muted, fontSize: 12, marginTop: 4, lineHeight: 16 }} numberOfLines={2}>
                      {igData.profile.bio}
                    </Text>
                  ) : null}
                </View>
              </Card>

              {/* Comprehensive Metric Cards (2-column grid) */}
              <View style={{ gap: 10 }}>
                {/* Row 1: Followers & Engagement % */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Card style={{ flex: 1, padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: PeacockColors.muted, fontSize: 12, fontWeight: '600' }}>
                        Followers
                      </Text>
                      <Users size={16} color={PeacockColors.teal} />
                    </View>
                    <Text style={{ color: PeacockColors.teal, fontSize: 20, fontWeight: '800' }}>
                      {igStats?.followers ? igStats.followers.toLocaleString() : '0'}
                    </Text>
                    <Text style={{ color: PeacockColors.muted, fontSize: 11, marginTop: 3 }}>
                      Total audience
                    </Text>
                  </Card>

                  <Card style={{ flex: 1, padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: PeacockColors.muted, fontSize: 12, fontWeight: '600' }}>
                        Engagement %
                      </Text>
                      <TrendingUp size={16} color={PeacockColors.ok} />
                    </View>
                    <Text style={{ color: PeacockColors.ok, fontSize: 20, fontWeight: '800' }}>
                      {igStats?.engagementRate ? `${igStats.engagementRate}%` : '0.00%'}
                    </Text>
                    <Text style={{ color: PeacockColors.muted, fontSize: 11, marginTop: 3 }}>
                      Likes & comments / fan
                    </Text>
                  </Card>
                </View>

                {/* Row 2: Avg Likes & Avg Comments */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Card style={{ flex: 1, padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: PeacockColors.muted, fontSize: 12, fontWeight: '600' }}>
                        Avg Likes
                      </Text>
                      <Heart size={16} color="#E1306C" />
                    </View>
                    <Text style={{ color: '#E1306C', fontSize: 20, fontWeight: '800' }}>
                      {igStats?.avgLikes ? igStats.avgLikes.toLocaleString() : '0'}
                    </Text>
                    <Text style={{ color: PeacockColors.muted, fontSize: 11, marginTop: 3 }}>
                      Per recent post
                    </Text>
                  </Card>

                  <Card style={{ flex: 1, padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: PeacockColors.muted, fontSize: 12, fontWeight: '600' }}>
                        Avg Comments
                      </Text>
                      <MessageCircle size={16} color={PeacockColors.blue} />
                    </View>
                    <Text style={{ color: PeacockColors.blue, fontSize: 20, fontWeight: '800' }}>
                      {igStats?.avgComments ? igStats.avgComments.toLocaleString() : '0'}
                    </Text>
                    <Text style={{ color: PeacockColors.muted, fontSize: 11, marginTop: 3 }}>
                      Per recent post
                    </Text>
                  </Card>
                </View>

                {/* Row 3: Total Posts & Following */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Card style={{ flex: 1, padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: PeacockColors.muted, fontSize: 12, fontWeight: '600' }}>
                        Total Posts
                      </Text>
                      <Video size={16} color={PeacockColors.gold} />
                    </View>
                    <Text style={{ color: PeacockColors.gold, fontSize: 20, fontWeight: '800' }}>
                      {igStats?.postsCount ? igStats.postsCount.toLocaleString() : '0'}
                    </Text>
                    <Text style={{ color: PeacockColors.muted, fontSize: 11, marginTop: 3 }}>
                      Published content
                    </Text>
                  </Card>

                  <Card style={{ flex: 1, padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: PeacockColors.muted, fontSize: 12, fontWeight: '600' }}>
                        Following
                      </Text>
                      <Users size={16} color={PeacockColors.muted} />
                    </View>
                    <Text style={{ color: PeacockColors.text, fontSize: 20, fontWeight: '800' }}>
                      {igStats?.following ? igStats.following.toLocaleString() : '0'}
                    </Text>
                    <Text style={{ color: PeacockColors.muted, fontSize: 11, marginTop: 3 }}>
                      Accounts followed
                    </Text>
                  </Card>
                </View>
              </View>

              {/* Recent Posts */}
              {igData.posts && igData.posts.length > 0 ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ color: PeacockColors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
                    Recent Posts ({igData.posts.length})
                  </Text>
                  <View style={{ gap: 10 }}>
                    {igData.posts.slice(0, 10).map((post) => (
                      <Card key={post.id} style={{ padding: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Badge
                            label={post.is_video ? 'Video / Reel' : 'Photo'}
                            variant={post.is_video ? 'blue' : 'teal'}
                          />
                          <Text style={{ color: PeacockColors.muted, fontSize: 11 }}>
                            {post.posted_at ? new Date(post.posted_at).toLocaleDateString() : ''}
                          </Text>
                        </View>

                        {post.caption ? (
                          <Text
                            style={{ color: PeacockColors.text, fontSize: 13, lineHeight: 18, marginBottom: 8 }}
                            numberOfLines={2}
                          >
                            {post.caption}
                          </Text>
                        ) : null}

                        <View style={{ flexDirection: 'row', gap: 16 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Heart size={14} color="#E1306C" />
                            <Text style={{ color: PeacockColors.muted, fontSize: 12, fontWeight: '600' }}>
                              {post.likes?.toLocaleString()}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <MessageCircle size={14} color={PeacockColors.blue} />
                            <Text style={{ color: PeacockColors.muted, fontSize: 12, fontWeight: '600' }}>
                              {post.comments?.toLocaleString()}
                            </Text>
                          </View>
                        </View>
                      </Card>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <Card style={{ alignItems: 'center', padding: 28 }}>
              <InstagramIcon size={36} color={PeacockColors.muted} />
              <Text style={{ color: PeacockColors.text, fontSize: 16, fontWeight: '600', marginTop: 12 }}>
                No Instagram Data Yet
              </Text>
              <Text style={{ color: PeacockColors.muted, fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 16 }}>
                Make sure your Instagram handle is added to your profile and tap Sync Stats.
              </Text>
              <Button
                title="Sync Instagram Now"
                variant="primary"
                onPress={handleTriggerScrape}
              />
            </Card>
          )}
        </View>
      ) : (
        /* YOUTUBE METRICS */
        <View style={{ gap: 16 }}>
          <Text style={{ color: PeacockColors.text, fontSize: 18, fontWeight: '700' }}>
            YouTube Performance
          </Text>

          {ytData?.channel ? (
            <>
              {/* Channel Bar */}
              <Card elevated style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {ytData.channel.profile_picture && !ytImgError ? (
                  <View style={{ position: 'relative' }}>
                    <Image
                      source={{ uri: ytData.channel.profile_picture }}
                      style={{
                        height: 58,
                        width: 58,
                        borderRadius: 29,
                        borderWidth: 2,
                        borderColor: '#FF0000',
                        backgroundColor: PeacockColors.deep,
                      }}
                      resizeMode="cover"
                      onError={() => setYtImgError(true)}
                    />
                    <View
                      style={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        backgroundColor: '#FF0000',
                        borderRadius: 10,
                        padding: 3,
                        borderWidth: 2,
                        borderColor: PeacockColors.surface,
                      }}
                    >
                      <YoutubeIcon size={10} color="#FFFFFF" />
                    </View>
                  </View>
                ) : (
                  <View
                    style={{
                      height: 58,
                      width: 58,
                      borderRadius: 29,
                      backgroundColor: 'rgba(255, 0, 0, 0.15)',
                      borderWidth: 2,
                      borderColor: '#FF0000',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <YoutubeIcon size={28} color="#FF0000" />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: PeacockColors.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
                    {ytData.channel.title}
                  </Text>
                  <Text style={{ color: PeacockColors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                    {ytData.channel.custom_url || ytData.channel.username || 'YouTube Creator'}
                  </Text>
                  {ytData.channel.description ? (
                    <Text style={{ color: PeacockColors.muted, fontSize: 12, marginTop: 4, lineHeight: 16 }} numberOfLines={2}>
                      {ytData.channel.description}
                    </Text>
                  ) : null}
                </View>
              </Card>

              {/* Comprehensive Metric Cards (2-column grid) */}
              <View style={{ gap: 10 }}>
                {/* Row 1: Subscribers & Engagement % */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Card style={{ flex: 1, padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: PeacockColors.muted, fontSize: 12, fontWeight: '600' }}>
                        Subscribers
                      </Text>
                      <Users size={16} color={PeacockColors.teal} />
                    </View>
                    <Text style={{ color: PeacockColors.teal, fontSize: 20, fontWeight: '800' }}>
                      {ytStats?.subscribers ? ytStats.subscribers.toLocaleString() : '0'}
                    </Text>
                    <Text style={{ color: PeacockColors.muted, fontSize: 11, marginTop: 3 }}>
                      Channel subscribers
                    </Text>
                  </Card>

                  <Card style={{ flex: 1, padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: PeacockColors.muted, fontSize: 12, fontWeight: '600' }}>
                        Avg Engagement
                      </Text>
                      <TrendingUp size={16} color={PeacockColors.ok} />
                    </View>
                    <Text style={{ color: PeacockColors.ok, fontSize: 20, fontWeight: '800' }}>
                      {ytStats?.engagementRate ? `${ytStats.engagementRate}%` : '0.00%'}
                    </Text>
                    <Text style={{ color: PeacockColors.muted, fontSize: 11, marginTop: 3 }}>
                      Likes / view sample
                    </Text>
                  </Card>
                </View>

                {/* Row 2: Avg Views & Avg Likes */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Card style={{ flex: 1, padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: PeacockColors.muted, fontSize: 12, fontWeight: '600' }}>
                        Avg Views
                      </Text>
                      <Eye size={16} color={PeacockColors.blue} />
                    </View>
                    <Text style={{ color: PeacockColors.blue, fontSize: 20, fontWeight: '800' }}>
                      {ytStats?.avgViews ? ytStats.avgViews.toLocaleString() : '0'}
                    </Text>
                    <Text style={{ color: PeacockColors.muted, fontSize: 11, marginTop: 3 }}>
                      Per recent video
                    </Text>
                  </Card>

                  <Card style={{ flex: 1, padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: PeacockColors.muted, fontSize: 12, fontWeight: '600' }}>
                        Avg Likes
                      </Text>
                      <Heart size={16} color="#FF0000" />
                    </View>
                    <Text style={{ color: '#FF0000', fontSize: 20, fontWeight: '800' }}>
                      {ytStats?.avgLikes ? ytStats.avgLikes.toLocaleString() : '0'}
                    </Text>
                    <Text style={{ color: PeacockColors.muted, fontSize: 11, marginTop: 3 }}>
                      Per recent video
                    </Text>
                  </Card>
                </View>

                {/* Row 3: Total Views & Total Videos */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Card style={{ flex: 1, padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: PeacockColors.muted, fontSize: 12, fontWeight: '600' }}>
                        Total Views
                      </Text>
                      <TrendingUp size={16} color={PeacockColors.gold} />
                    </View>
                    <Text style={{ color: PeacockColors.gold, fontSize: 20, fontWeight: '800' }}>
                      {ytStats?.totalChannelViews ? ytStats.totalChannelViews.toLocaleString() : '0'}
                    </Text>
                    <Text style={{ color: PeacockColors.muted, fontSize: 11, marginTop: 3 }}>
                      Channel lifetime views
                    </Text>
                  </Card>

                  <Card style={{ flex: 1, padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: PeacockColors.muted, fontSize: 12, fontWeight: '600' }}>
                        Total Videos
                      </Text>
                      <Video size={16} color={PeacockColors.teal} />
                    </View>
                    <Text style={{ color: PeacockColors.teal, fontSize: 20, fontWeight: '800' }}>
                      {ytStats?.totalVideos ? ytStats.totalVideos.toLocaleString() : '0'}
                    </Text>
                    <Text style={{ color: PeacockColors.muted, fontSize: 11, marginTop: 3 }}>
                      Uploaded videos
                    </Text>
                  </Card>
                </View>
              </View>

              {/* Recent Videos */}
              {ytData.videos && ytData.videos.length > 0 ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ color: PeacockColors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
                    Recent Videos ({ytData.videos.length})
                  </Text>
                  <View style={{ gap: 10 }}>
                    {ytData.videos.slice(0, 10).map((video) => (
                      <Card key={video.id} style={{ padding: 12 }}>
                        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                          {video.thumbnail ? (
                            <Image
                              source={{ uri: video.thumbnail }}
                              style={{
                                width: 90,
                                height: 56,
                                borderRadius: 8,
                                backgroundColor: PeacockColors.deep,
                              }}
                              resizeMode="cover"
                            />
                          ) : null}
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              style={{ color: PeacockColors.text, fontSize: 13, fontWeight: '600', marginBottom: 6 }}
                              numberOfLines={2}
                            >
                              {video.title}
                            </Text>

                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Eye size={13} color={PeacockColors.teal} />
                                <Text style={{ color: PeacockColors.muted, fontSize: 11, fontWeight: '600' }}>
                                  {video.views?.toLocaleString()}
                                </Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Heart size={13} color="#FF0000" />
                                <Text style={{ color: PeacockColors.muted, fontSize: 11, fontWeight: '600' }}>
                                  {video.likes?.toLocaleString()}
                                </Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <MessageCircle size={13} color={PeacockColors.blue} />
                                <Text style={{ color: PeacockColors.muted, fontSize: 11, fontWeight: '600' }}>
                                  {video.comments?.toLocaleString()}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      </Card>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <Card style={{ alignItems: 'center', padding: 28 }}>
              <YoutubeIcon size={36} color={PeacockColors.muted} />
              <Text style={{ color: PeacockColors.text, fontSize: 16, fontWeight: '600', marginTop: 12 }}>
                No YouTube Data Yet
              </Text>
              <Text style={{ color: PeacockColors.muted, fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 16 }}>
                Make sure your YouTube channel handle is added to your profile and tap Sync Stats.
              </Text>
              <Button
                title="Sync YouTube Now"
                variant="primary"
                onPress={handleTriggerScrape}
              />
            </Card>
          )}
        </View>
      )}
    </ScrollView>
  );
}
