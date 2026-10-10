import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Clapperboard,
  Compass,
  Edit3,
  FileText,
  Megaphone,
  Sparkles,
  TrendingUp,
  Users,
  WandSparkles,
} from 'lucide-react-native';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PeacockColors } from '../../constants/Colors';
import {
  Campaign,
  InterestedCreatorsResponse,
  ProfileStatus,
} from '../../types';

export default function StudioScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isBrand = user?.role === 'BRAND';

  // Query profile status
  const {
    data: statusData,
    refetch: refetchStatus,
    isRefetching: statusRefetching,
  } = useQuery({
    queryKey: ['profile-status', user?.id],
    queryFn: async () => {
      const res = await api.get<ProfileStatus>('/users/profile-status');
      return res.data;
    },
    enabled: !!user,
  });

  // Query campaigns if brand
  const { data: campaigns, refetch: refetchCampaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await api.get<Campaign[]>('/campaigns');
      return res.data;
    },
    enabled: !!user && isBrand,
  });

  // Query interested creators if brand
  const { data: interestedData, refetch: refetchInterested } = useQuery({
    queryKey: ['interested-creators'],
    queryFn: async () => {
      const res = await api.get<InterestedCreatorsResponse>('/ai/interested-creators');
      return res.data;
    },
    enabled: !!user && isBrand,
  });

  const onRefresh = async () => {
    await Promise.all([
      refetchStatus(),
      isBrand ? refetchCampaigns() : Promise.resolve(),
      isBrand ? refetchInterested() : Promise.resolve(),
    ]);
  };

  const hasProfile = statusData?.has_profile ?? true;
  const isComplete = statusData?.is_complete ?? true;
  const locked = user ? !hasProfile || !isComplete : false;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: PeacockColors.bg }}
      contentContainerStyle={{
        padding: 20,
        paddingBottom: 56,
        maxWidth: 640,
        width: '100%',
        alignSelf: 'center',
      }}
      refreshControl={
        <RefreshControl
          refreshing={statusRefetching}
          onRefresh={onRefresh}
          tintColor={PeacockColors.teal}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header Banner */}
      {/* <View style={{ marginBottom: 20, marginTop: 4 }}>
        <Text
          style={{
            color: PeacockColors.text,
            fontSize: 28,
            fontWeight: '800',
            letterSpacing: -0.5,
            marginBottom: 6,
          }}
        >
          {isBrand ? 'Brand Studio' : 'Creator Studio'}
        </Text>
        <Text style={{ color: PeacockColors.muted, fontSize: 15, lineHeight: 22 }}>
          {isBrand
            ? 'Smarter creator collaborations powered by Gemini AI.'
            : 'Everything creators need to land deals & grow with AI.'}
        </Text>
      </View> */}

      {/* Brand Fast KPI Overview Bar */}
      {isBrand && (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/campaigns' as any)}
            style={{
              flex: 1,
              backgroundColor: PeacockColors.surface,
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: PeacockColors.line,
            }}
          >
            <Text
              style={{
                color: PeacockColors.muted,
                fontSize: 11,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Campaigns
            </Text>
            <Text
              style={{
                color: PeacockColors.gold,
                fontSize: 24,
                fontWeight: '800',
                marginTop: 4,
              }}
            >
              {campaigns?.length ?? 0}
            </Text>
            <Text style={{ color: PeacockColors.muted, fontSize: 11, marginTop: 2 }}>
              Active briefs
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/interested-creators' as any)}
            style={{
              flex: 1,
              backgroundColor: PeacockColors.surface,
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: PeacockColors.line,
            }}
          >
            <Text
              style={{
                color: PeacockColors.muted,
                fontSize: 11,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Inbound
            </Text>
            <Text
              style={{
                color: PeacockColors.blue,
                fontSize: 24,
                fontWeight: '800',
                marginTop: 4,
              }}
            >
              {interestedData?.creators?.length ?? 0}
            </Text>
            <Text style={{ color: PeacockColors.muted, fontSize: 11, marginTop: 2 }}>
              Pitch responses
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/discover' as any)}
            style={{
              flex: 1,
              backgroundColor: PeacockColors.surface,
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: PeacockColors.line,
            }}
          >
            <Text
              style={{
                color: PeacockColors.muted,
                fontSize: 11,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Discovery
            </Text>
            <Text
              style={{
                color: PeacockColors.teal,
                fontSize: 24,
                fontWeight: '800',
                marginTop: 4,
              }}
            >
              AI
            </Text>
            <Text style={{ color: PeacockColors.muted, fontSize: 11, marginTop: 2 }}>
              Ranked creators
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Profile Incomplete Banner */}
      {locked ? (
        <Card
          style={{
            backgroundColor: 'rgba(38, 189, 176, 0.1)',
            borderColor: 'rgba(38, 189, 176, 0.35)',
            borderWidth: 1,
            marginBottom: 20,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <Sparkles size={22} color={PeacockColors.teal} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: PeacockColors.teal, fontSize: 16, fontWeight: '700' }}>
                One step to go
              </Text>
              <Text
                style={{
                  color: PeacockColors.text,
                  fontSize: 13,
                  marginTop: 4,
                  lineHeight: 18,
                }}
              >
                {isBrand
                  ? 'Add your brand profile — industry, budget, and goals — so we can match you to the right creators.'
                  : "Add your creator profile and social handles — we'll pull in your analytics, compute your Authenticity Score, and unlock your AI tools."}
              </Text>
              <Button
                title={hasProfile ? 'Complete Profile' : 'Complete Your Profile'}
                variant="primary"
                icon={<Edit3 size={14} color={PeacockColors.onTeal} />}
                onPress={() => router.push('/profile-edit' as any)}
                style={{
                  marginTop: 12,
                  alignSelf: 'flex-start',
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                }}
              />
            </View>
          </View>
        </Card>
      ) : null}

      {/* Primary Action Cards */}
      <View style={{ gap: 16 }}>
        {!isBrand ? (
          <>
            {/* Creator Card 1: Brand Deals */}
            <Card elevated style={{ opacity: locked ? 0.7 : 1 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      height: 42,
                      width: 42,
                      borderRadius: 12,
                      backgroundColor: 'rgba(38, 189, 176, 0.15)',
                      borderColor: 'rgba(38, 189, 176, 0.35)',
                      borderWidth: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Sparkles size={22} color={PeacockColors.teal} />
                  </View>
                  <Text style={{ color: PeacockColors.text, fontSize: 19, fontWeight: '700' }}>
                    Brand Deals
                  </Text>
                </View>
                <Badge
                  label={locked ? 'Profile Needed' : 'AI Matched'}
                  variant={locked ? 'muted' : 'teal'}
                />
              </View>
              <Text
                style={{
                  color: PeacockColors.muted,
                  fontSize: 14,
                  lineHeight: 20,
                  marginBottom: 16,
                }}
              >
                Discover curated opportunities matched to your audience. Review compensation and deliverables, and send pitches directly.
              </Text>
              <Button
                title={locked ? 'Complete Profile to Unlock' : 'View Deals'}
                variant={locked ? 'secondary' : 'primary'}
                onPress={() => {
                  if (locked) router.push('/profile-edit' as any);
                  else router.push('/(tabs)/deals');
                }}
              />
            </Card>

            {/* Creator Card 2: AI Growth Strategy */}
            <Card elevated>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      height: 42,
                      width: 42,
                      borderRadius: 12,
                      backgroundColor: 'rgba(216, 180, 90, 0.15)',
                      borderColor: 'rgba(216, 180, 90, 0.35)',
                      borderWidth: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FileText size={22} color={PeacockColors.gold} />
                  </View>
                  <Text style={{ color: PeacockColors.text, fontSize: 19, fontWeight: '700' }}>
                    AI Growth Strategy
                  </Text>
                </View>
                <Badge label="Gemini AI" variant="gold" />
              </View>
              <Text
                style={{
                  color: PeacockColors.muted,
                  fontSize: 14,
                  lineHeight: 20,
                  marginBottom: 16,
                }}
              >
                Generate comprehensive AI analysis of your strengths, monetization opportunities, best brand matches, and viral formats.
              </Text>
              <Button
                title="View Growth Strategy"
                variant="secondary"
                onPress={() => router.push('/analyze-profile' as any)}
              />
            </Card>

            {/* Creator Card 3: Authenticity & Analytics */}
            <Card elevated>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      height: 42,
                      width: 42,
                      borderRadius: 12,
                      backgroundColor: 'rgba(79, 179, 217, 0.15)',
                      borderColor: 'rgba(79, 179, 217, 0.35)',
                      borderWidth: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TrendingUp size={22} color={PeacockColors.blue} />
                  </View>
                  <Text style={{ color: PeacockColors.text, fontSize: 19, fontWeight: '700' }}>
                    Authenticity & Signals
                  </Text>
                </View>
                <Badge label="Verified" variant="blue" />
              </View>
              <Text
                style={{
                  color: PeacockColors.muted,
                  fontSize: 14,
                  lineHeight: 20,
                  marginBottom: 16,
                }}
              >
                Inspect your live Instagram and YouTube scraping metrics, engagement ratios, and your verified Authenticity Score.
              </Text>
              <Button
                title="View Analytics & Score"
                variant="primary"
                onPress={() => router.push('/analytics' as any)}
              />
            </Card>

            {/* Creator Card 4: Crewaa Crew (Coming Soon) */}
            <Card style={{ opacity: 0.85 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      height: 42,
                      width: 42,
                      borderRadius: 12,
                      backgroundColor: 'rgba(180, 156, 240, 0.15)',
                      borderColor: 'rgba(180, 156, 240, 0.35)',
                      borderWidth: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Clapperboard size={22} color="#B49CF0" />
                  </View>
                  <Text style={{ color: PeacockColors.text, fontSize: 19, fontWeight: '700' }}>
                    Crewaa Crew
                  </Text>
                </View>
                <Badge label="Coming Soon" variant="muted" />
              </View>
              <Text style={{ color: PeacockColors.muted, fontSize: 14, lineHeight: 20 }}>
                Video editors, scriptwriters, and designers from our vetted pool. Delegate the editing work.
              </Text>
            </Card>
          </>
        ) : (
          <>
            {/* Brand Card 1: Discover Creators */}
            <Card elevated style={{ opacity: locked ? 0.7 : 1 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      height: 42,
                      width: 42,
                      borderRadius: 12,
                      backgroundColor: 'rgba(38, 189, 176, 0.15)',
                      borderColor: 'rgba(38, 189, 176, 0.35)',
                      borderWidth: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Compass size={22} color={PeacockColors.teal} />
                  </View>
                  <Text style={{ color: PeacockColors.text, fontSize: 19, fontWeight: '700' }}>
                    Discover Creators
                  </Text>
                </View>
                <Badge
                  label={locked ? 'Profile Needed' : 'AI Ranked'}
                  variant={locked ? 'muted' : 'teal'}
                />
              </View>
              <Text
                style={{
                  color: PeacockColors.muted,
                  fontSize: 14,
                  lineHeight: 20,
                  marginBottom: 16,
                }}
              >
                Find verified creators scored for authenticity and ranked by Gemini AI to match your campaign niche, budget, and platform.
              </Text>
              <Button
                title={locked ? 'Complete Profile to Unlock' : 'Discover Creators'}
                variant={locked ? 'secondary' : 'primary'}
                onPress={() => {
                  if (locked) router.push('/profile-edit' as any);
                  else router.push('/discover' as any);
                }}
              />
            </Card>

            {/* Brand Card 2: Manage Campaigns */}
            <Card elevated>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      height: 42,
                      width: 42,
                      borderRadius: 12,
                      backgroundColor: 'rgba(216, 180, 90, 0.15)',
                      borderColor: 'rgba(216, 180, 90, 0.35)',
                      borderWidth: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Megaphone size={22} color={PeacockColors.gold} />
                  </View>
                  <Text style={{ color: PeacockColors.text, fontSize: 19, fontWeight: '700' }}>
                    Campaigns
                  </Text>
                </View>
                <Badge label={`${campaigns?.length ?? 0} Total`} variant="gold" />
              </View>
              <Text
                style={{
                  color: PeacockColors.muted,
                  fontSize: 14,
                  lineHeight: 20,
                  marginBottom: 16,
                }}
              >
                Create campaign briefs with target deliverables, niche criteria, and compensation. Match directly with qualified creators.
              </Text>
              <Button
                title="Manage Campaigns"
                variant="secondary"
                onPress={() => router.push('/campaigns' as any)}
              />
            </Card>

            {/* Brand Card 3: Interested Creators / Responses */}
            <Card elevated>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      height: 42,
                      width: 42,
                      borderRadius: 12,
                      backgroundColor: 'rgba(79, 179, 217, 0.15)',
                      borderColor: 'rgba(79, 179, 217, 0.35)',
                      borderWidth: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Users size={22} color={PeacockColors.blue} />
                  </View>
                  <Text style={{ color: PeacockColors.text, fontSize: 19, fontWeight: '700' }}>
                    Inbound Responses
                  </Text>
                </View>
                <Badge
                  label={`${interestedData?.creators?.length ?? 0} Pitches`}
                  variant="blue"
                />
              </View>
              <Text
                style={{
                  color: PeacockColors.muted,
                  fontSize: 14,
                  lineHeight: 20,
                  marginBottom: 16,
                }}
              >
                Creators who expressed interest in your campaigns. Review their pitch notes, authenticity scores, and start collaborating.
              </Text>
              <Button
                title="Review Responses"
                variant="primary"
                onPress={() => router.push('/interested-creators' as any)}
              />
            </Card>
          </>
        )}

        {/* Marketing Suite (Shared Coming Soon) */}
        <Card style={{ opacity: 0.85 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  height: 42,
                  width: 42,
                  borderRadius: 12,
                  backgroundColor: 'rgba(238, 138, 107, 0.15)',
                  borderColor: 'rgba(238, 138, 107, 0.35)',
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <WandSparkles size={22} color="#EE8A6B" />
              </View>
              <Text style={{ color: PeacockColors.text, fontSize: 19, fontWeight: '700' }}>
                Marketing Suite
              </Text>
            </View>
            <Badge label="Coming Soon" variant="muted" />
          </View>
          <Text style={{ color: PeacockColors.muted, fontSize: 14, lineHeight: 20 }}>
            AI-assisted captions, hooks, and content calendar planned from real performance data.
          </Text>
        </Card>
      </View>
    </ScrollView>
  );
}
