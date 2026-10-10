import React, { useEffect, useState } from 'react';
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
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  Compass,
  Filter,
  Flame,
  Heart,
  HelpCircle,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  TrendingUp,
  Users,
} from 'lucide-react-native';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Card } from '../components/ui/Card';
import { Badge, BadgeVariant } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { InstagramIcon, YoutubeIcon } from '../components/icons/SocialIcons';
import { PeacockColors } from '../constants/Colors';
import { Campaign, DiscoverResult, RankedCreator } from '../types';

const NICHES = [
  'Fitness',
  'Fashion',
  'Tech',
  'Gaming',
  'Beauty',
  'Food',
  'Travel',
  'Lifestyle',
  'Education',
  'Finance',
  'Health',
  'Music',
  'Comedy',
  'Sports',
];

const BUDGET_RANGES = [
  { label: 'Low (< ₹20K)', value: 'Low' },
  { label: 'Mid (₹20K - ₹1L)', value: 'Mid' },
  { label: 'High (> ₹1L)', value: 'High' },
];

const GOALS = ['Awareness', 'Sales', 'Engagement'];

export default function DiscoverCreatorsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Mode: Campaign match vs custom filter
  const [useCampaign, setUseCampaign] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);

  // Custom filters
  const [niche, setNiche] = useState('Tech');
  const [budgetRange, setBudgetRange] = useState('Mid');
  const [campaignGoal, setCampaignGoal] = useState('Awareness');
  const [targetLocation, setTargetLocation] = useState('India');
  const [platform, setPlatform] = useState<'instagram' | 'youtube'>('instagram');

  // Search state
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<DiscoverResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedCreators, setSavedCreators] = useState<Record<string, boolean>>({});

  // Query brand campaigns to allow matching against active campaign
  const { data: campaigns } = useQuery({
    queryKey: ['brand-campaigns-discover'],
    queryFn: async () => {
      const res = await api.get<Campaign[]>('/campaigns');
      return res.data;
    },
    enabled: !!user && user?.role === 'BRAND',
  });

  const activeCampaigns = (campaigns || []).filter((c) => c.status !== 'closed');

  const handleDiscover = async () => {
    setSearching(true);
    setError(null);

    const payload = useCampaign && selectedCampaignId
      ? { campaign_id: selectedCampaignId }
      : {
          niche,
          budget_range: budgetRange,
          campaign_goal: campaignGoal,
          target_location: targetLocation,
          platform_preferences: [platform],
        };

    try {
      const res = await api.post<DiscoverResult>('/ai/discover-creators', payload);
      setResult(res.data);
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to discover creators.');
    } finally {
      setSearching(false);
    }
  };

  const handleSaveCreator = async (creator: RankedCreator) => {
    const creatorId = creator.creator_id;
    const isSaved = !!savedCreators[creatorId];
    if (isSaved) return;

    try {
      await api.post('/ai/save-creator', {
        creator_id: Number(creatorId),
        fit_level: creator.fit_level,
        score_reasoning: creator.score_reasoning ? JSON.stringify(creator.score_reasoning) : null,
      });
      setSavedCreators((prev) => ({ ...prev, [creatorId]: true }));
    } catch (err: any) {
      console.warn('Could not save creator', err);
    }
  };

  const getFitBadgeVariant = (fit: string): BadgeVariant => {
    const lower = fit.toLowerCase();
    if (lower.includes('high')) return 'ok';
    if (lower.includes('medium')) return 'blue';
    return 'warn';
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: PeacockColors.bg }}
      contentContainerStyle={{ padding: 20, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: PeacockColors.text, fontSize: 26, fontWeight: '800' }}>
          Discover Creators
        </Text>
        <Text style={{ color: PeacockColors.muted, fontSize: 14, marginTop: 4 }}>
          AI-powered matching based on authenticity, niche affinity, and audience quality.
        </Text>
      </View>

      {/* Filter / Search Card */}
      <Card elevated style={{ marginBottom: 20 }}>
        {/* Toggle Mode */}
        {activeCampaigns.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              borderRadius: 12,
              backgroundColor: PeacockColors.deep,
              padding: 4,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: PeacockColors.line,
            }}
          >
            <Pressable
              onPress={() => setUseCampaign(false)}
              style={{
                flex: 1,
                paddingVertical: 8,
                alignItems: 'center',
                borderRadius: 8,
                backgroundColor: !useCampaign ? PeacockColors.surface : 'transparent',
              }}
            >
              <Text
                style={{
                  color: !useCampaign ? PeacockColors.text : PeacockColors.muted,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                Custom Filters
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setUseCampaign(true);
                if (!selectedCampaignId && activeCampaigns.length > 0) {
                  setSelectedCampaignId(activeCampaigns[0].id);
                }
              }}
              style={{
                flex: 1,
                paddingVertical: 8,
                alignItems: 'center',
                borderRadius: 8,
                backgroundColor: useCampaign ? PeacockColors.surface : 'transparent',
              }}
            >
              <Text
                style={{
                  color: useCampaign ? PeacockColors.text : PeacockColors.muted,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                From Campaign ({activeCampaigns.length})
              </Text>
            </Pressable>
          </View>
        ) : null}

        {useCampaign ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
              Select Active Campaign
            </Text>
            <View style={{ gap: 8 }}>
              {activeCampaigns.map((camp) => (
                <Pressable
                  key={camp.id}
                  onPress={() => setSelectedCampaignId(camp.id)}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: selectedCampaignId === camp.id ? PeacockColors.teal : PeacockColors.line,
                    backgroundColor: selectedCampaignId === camp.id ? 'rgba(38, 189, 176, 0.12)' : PeacockColors.deep,
                  }}
                >
                  <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '700' }}>
                    {camp.name}
                  </Text>
                  <Text style={{ color: PeacockColors.muted, fontSize: 12, marginTop: 2 }}>
                    {camp.niche} • {camp.campaign_goal} • ₹{camp.budget_per_creator?.toLocaleString() || 'Flexible'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <>
            {/* Niche Pills */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
                Creator Category / Niche
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {NICHES.map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setNiche(n)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: niche === n ? PeacockColors.teal : PeacockColors.line,
                      backgroundColor: niche === n ? PeacockColors.teal : PeacockColors.deep,
                    }}
                  >
                    <Text
                      style={{
                        color: niche === n ? PeacockColors.onTeal : PeacockColors.text,
                        fontSize: 12,
                        fontWeight: '600',
                      }}
                    >
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Platform Selection */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
                Primary Platform
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => setPlatform('instagram')}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: 10,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: platform === 'instagram' ? '#E1306C' : PeacockColors.line,
                    backgroundColor: platform === 'instagram' ? 'rgba(225, 48, 108, 0.12)' : PeacockColors.deep,
                  }}
                >
                  <InstagramIcon size={18} color="#E1306C" />
                  <Text style={{ color: PeacockColors.text, fontSize: 13, fontWeight: '600' }}>Instagram</Text>
                </Pressable>

                <Pressable
                  onPress={() => setPlatform('youtube')}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: 10,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: platform === 'youtube' ? '#FF0000' : PeacockColors.line,
                    backgroundColor: platform === 'youtube' ? 'rgba(255, 0, 0, 0.12)' : PeacockColors.deep,
                  }}
                >
                  <YoutubeIcon size={18} color="#FF0000" />
                  <Text style={{ color: PeacockColors.text, fontSize: 13, fontWeight: '600' }}>YouTube</Text>
                </Pressable>
              </View>
            </View>

            {/* Budget Range */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
                Budget Tier
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {BUDGET_RANGES.map((b) => (
                  <Pressable
                    key={b.value}
                    onPress={() => setBudgetRange(b.value)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      alignItems: 'center',
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: budgetRange === b.value ? PeacockColors.gold : PeacockColors.line,
                      backgroundColor: budgetRange === b.value ? 'rgba(216, 180, 90, 0.15)' : PeacockColors.deep,
                    }}
                  >
                    <Text
                      style={{
                        color: budgetRange === b.value ? PeacockColors.gold : PeacockColors.muted,
                        fontSize: 12,
                        fontWeight: '700',
                      }}
                    >
                      {b.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Location Input */}
            <Input
              label="Target Location"
              value={targetLocation}
              onChangeText={setTargetLocation}
              placeholder="e.g. India, Mumbai, Delhi"
            />
          </>
        )}

        <Button
          title={searching ? 'Analyzing & Ranking Creators…' : 'Find Matching Creators'}
          variant="primary"
          loading={searching}
          icon={!searching ? <Sparkles size={16} color={PeacockColors.onTeal} /> : undefined}
          onPress={handleDiscover}
          style={{ marginTop: 8 }}
        />
      </Card>

      {/* Error message */}
      {error ? (
        <View style={{ backgroundColor: 'rgba(242, 113, 107, 0.15)', padding: 14, borderRadius: 12, marginBottom: 16 }}>
          <Text style={{ color: PeacockColors.danger, fontSize: 13 }}>{error}</Text>
        </View>
      ) : null}

      {/* Results Section */}
      {result ? (
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: PeacockColors.text, fontSize: 18, fontWeight: '700' }}>
              Ranked Creators ({result.ranked_creators?.length || 0})
            </Text>
            {result.campaign_name ? (
              <Badge label={`Campaign: ${result.campaign_name}`} variant="blue" />
            ) : null}
          </View>

          {/* AI Final Recommendation Banner */}
          {result.final_recommendation ? (
            <Card style={{ backgroundColor: 'rgba(38, 189, 176, 0.1)', borderColor: 'rgba(38, 189, 176, 0.3)', borderWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Sparkles size={20} color={PeacockColors.teal} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: PeacockColors.teal, fontSize: 14, fontWeight: '700' }}>
                    AI Recommendation
                  </Text>
                  <Text style={{ color: PeacockColors.text, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                    {result.final_recommendation}
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}

          {/* Creator Cards */}
          {result.ranked_creators && result.ranked_creators.length > 0 ? (
            result.ranked_creators.map((creator) => {
              const isSaved = !!savedCreators[creator.creator_id];
              return (
                <Card key={creator.creator_id} elevated style={{ gap: 12 }}>
                  {/* Top Bar: Name, Fit badge, handles */}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ color: PeacockColors.text, fontSize: 18, fontWeight: '700' }}>
                        {creator.creator_name || 'Creator'}
                      </Text>
                      <Text style={{ color: PeacockColors.muted, fontSize: 12, marginTop: 2 }}>
                        {creator.category || 'Creator'} • {creator.location || 'India'}
                      </Text>
                    </View>
                    <Badge
                      label={creator.fit_level.toUpperCase()}
                      variant={getFitBadgeVariant(creator.fit_level)}
                    />
                  </View>

                  {/* Handles */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {creator.instagram_username ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: PeacockColors.deep, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                        <InstagramIcon size={13} color="#E1306C" />
                        <Text style={{ color: PeacockColors.text, fontSize: 11 }}>@{creator.instagram_username}</Text>
                      </View>
                    ) : null}
                    {creator.youtube_username ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: PeacockColors.deep, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                        <YoutubeIcon size={13} color="#FF0000" />
                        <Text style={{ color: PeacockColors.text, fontSize: 11 }}>{creator.youtube_username}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* 4 Stats Grid */}
                  <View style={{ flexDirection: 'row', backgroundColor: PeacockColors.deep, borderRadius: 12, padding: 12, justifyContent: 'space-around' }}>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: PeacockColors.muted, fontSize: 11, fontWeight: '600' }}>Audience</Text>
                      <Text style={{ color: PeacockColors.teal, fontSize: 15, fontWeight: '800', marginTop: 2 }}>
                        {creator.followers ? (creator.followers >= 1000 ? `${(creator.followers / 1000).toFixed(1)}K` : creator.followers) : creator.subscribers ? `${(creator.subscribers / 1000).toFixed(1)}K` : '–'}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: PeacockColors.muted, fontSize: 11, fontWeight: '600' }}>Engagement</Text>
                      <Text style={{ color: PeacockColors.ok, fontSize: 15, fontWeight: '800', marginTop: 2 }}>
                        {creator.engagement_rate != null ? `${creator.engagement_rate.toFixed(1)}%` : '–'}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: PeacockColors.muted, fontSize: 11, fontWeight: '600' }}>Avg Likes</Text>
                      <Text style={{ color: '#E1306C', fontSize: 15, fontWeight: '800', marginTop: 2 }}>
                        {creator.avg_likes ? creator.avg_likes.toLocaleString() : '–'}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: PeacockColors.muted, fontSize: 11, fontWeight: '600' }}>AI Score</Text>
                      <Text style={{ color: PeacockColors.gold, fontSize: 15, fontWeight: '800', marginTop: 2 }}>
                        {creator.authenticity?.score != null ? `${creator.authenticity.score}` : '–'}
                      </Text>
                    </View>
                  </View>

                  {/* Reasoning list */}
                  {creator.score_reasoning && creator.score_reasoning.length > 0 ? (
                    <View style={{ gap: 4 }}>
                      {creator.score_reasoning.slice(0, 3).map((reason, idx) => (
                        <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                          <Check size={14} color={PeacockColors.teal} style={{ marginTop: 2 }} />
                          <Text style={{ color: PeacockColors.text, fontSize: 12, flex: 1, lineHeight: 17 }}>
                            {reason}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {/* Actions */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <Button
                      title={isSaved ? 'Saved to Shortlist ✓' : 'Save Creator'}
                      variant={isSaved ? 'secondary' : 'outline'}
                      icon={<Bookmark size={15} color={isSaved ? PeacockColors.teal : PeacockColors.text} />}
                      onPress={() => handleSaveCreator(creator)}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title="Contact / Chat"
                      variant="primary"
                      icon={<MessageCircle size={15} color={PeacockColors.onTeal} />}
                      onPress={() => router.push('/(tabs)/messages')}
                      style={{ flex: 1 }}
                    />
                  </View>
                </Card>
              );
            })
          ) : (
            <Card style={{ alignItems: 'center', padding: 24 }}>
              <Users size={32} color={PeacockColors.muted} />
              <Text style={{ color: PeacockColors.text, fontSize: 16, fontWeight: '700', marginTop: 8 }}>
                No Creators Found
              </Text>
              <Text style={{ color: PeacockColors.muted, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                Try selecting a broader niche or relaxing your follower/budget criteria.
              </Text>
            </Card>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}
