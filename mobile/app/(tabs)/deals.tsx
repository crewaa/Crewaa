import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Bookmark, Briefcase, Calendar, Check, DollarSign, LogIn } from 'lucide-react-native';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { Card } from '../../components/ui/Card';
import { Badge, BadgeVariant } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PeacockColors } from '../../constants/Colors';
import { BrandDeal, Campaign } from '../../types';

export default function DealsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isBrand = user?.role === 'BRAND';
  const [interestedIds, setInterestedIds] = useState<Record<string, boolean>>({});

  // Query creator brand deals only when user is logged in
  const {
    data: dealsData,
    isLoading: dealsLoading,
    refetch: refetchDeals,
    isRefetching: dealsRefetching,
  } = useQuery({
    queryKey: ['brand-deals'],
    queryFn: async () => {
      const res = await api.get<{ opportunities: BrandDeal[]; total: number }>('/ai/brand-deals');
      return res.data;
    },
    enabled: !!user && !isBrand,
  });

  // Query brand campaigns only when user is logged in
  const {
    data: campaignsData,
    isLoading: campaignsLoading,
    refetch: refetchCampaigns,
    isRefetching: campaignsRefetching,
  } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await api.get<Campaign[]>('/campaigns');
      return res.data;
    },
    enabled: !!user && isBrand,
  });

  const getFitBadgeVariant = (fit?: string): BadgeVariant => {
    const lower = (fit || '').toLowerCase();
    if (lower.includes('high')) return 'ok';
    if (lower.includes('medium')) return 'blue';
    if (lower.includes('low')) return 'warn';
    return 'teal';
  };

  const toggleInterest = async (oppId: string) => {
    const isNow = !interestedIds[oppId];
    setInterestedIds((prev) => ({ ...prev, [oppId]: isNow }));
    try {
      if (isNow) {
        await api.post('/ai/opportunities/interest', { opportunity_id: oppId });
      } else {
        await api.delete(`/ai/opportunities/interest/${oppId}`);
      }
    } catch {
      setInterestedIds((prev) => ({ ...prev, [oppId]: !isNow }));
    }
  };

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
          <Briefcase size={40} color={PeacockColors.teal} />
          <Text style={{ color: PeacockColors.text, fontSize: 20, fontWeight: '700', marginTop: 16 }}>
            Authentication Required
          </Text>
          <Text style={{ color: PeacockColors.muted, fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 20 }}>
            Sign in to view curated brand deals and manage your campaigns.
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

  const renderDealItem = ({ item }: { item: BrandDeal }) => {
    const isInterested = interestedIds[item.opportunity_id] ?? item.interested;

    return (
      <Card elevated style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={{ color: PeacockColors.text, fontSize: 18, fontWeight: '700' }}>
              {item.industry_hint || 'Curated Brand Campaign'}
            </Text>
            <Text style={{ color: PeacockColors.muted, fontSize: 13, marginTop: 2 }}>
              {item.campaign_type || 'Sponsored Collaboration'}
            </Text>
          </View>
          {item.fit_level ? (
            <Badge
              label={item.fit_level}
              variant={getFitBadgeVariant(item.fit_level)}
            />
          ) : null}
        </View>

        {item.campaign_requirements ? (
          <Text style={{ color: PeacockColors.text, fontSize: 14, lineHeight: 20, marginBottom: 14 }}>
            {item.campaign_requirements}
          </Text>
        ) : null}

        {/* Commercial details */}
        <View
          style={{
            borderRadius: 12,
            backgroundColor: PeacockColors.deep,
            padding: 12,
            gap: 8,
            marginBottom: 14,
            borderWidth: 1,
            borderColor: 'rgba(28, 59, 67, 0.6)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <DollarSign size={16} color={PeacockColors.gold} />
            <Text style={{ color: PeacockColors.text, fontSize: 13, fontWeight: '500' }}>
              Compensation:{' '}
              <Text style={{ color: PeacockColors.gold, fontWeight: '700' }}>
                {item.compensation || item.budget_range || 'Competitive'}
              </Text>
            </Text>
          </View>
          {item.timeline ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Calendar size={16} color={PeacockColors.blue} />
              <Text style={{ color: PeacockColors.muted, fontSize: 13 }}>
                Timeline: {item.timeline}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Deliverables tags */}
        {item.deliverables && item.deliverables.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {item.deliverables.map((deliv, idx) => (
              <Badge key={idx} label={deliv} variant="muted" />
            ))}
          </View>
        ) : null}

        <Button
          title={isInterested ? 'Interested ✓' : "I'm Interested"}
          variant={isInterested ? 'secondary' : 'primary'}
          icon={isInterested ? <Check size={16} color={PeacockColors.text} /> : <Bookmark size={16} color={PeacockColors.onTeal} />}
          onPress={() => toggleInterest(item.opportunity_id)}
        />
      </Card>
    );
  };

  const renderCampaignItem = ({ item }: { item: Campaign }) => (
    <Card elevated style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ color: PeacockColors.text, fontSize: 18, fontWeight: '700' }}>{item.name}</Text>
          <Text style={{ color: PeacockColors.muted, fontSize: 13, marginTop: 2 }}>{item.niche}</Text>
        </View>
        <Badge
          label={item.status.toUpperCase()}
          variant={item.status === 'active' ? 'ok' : 'muted'}
        />
      </View>

      <Text style={{ color: PeacockColors.muted, fontSize: 14, lineHeight: 20, marginBottom: 12 }}>
        Goal: {item.campaign_goal}
      </Text>

      <View
        style={{
          borderRadius: 12,
          backgroundColor: PeacockColors.deep,
          padding: 12,
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 12,
          borderWidth: 1,
          borderColor: 'rgba(28, 59, 67, 0.6)',
        }}
      >
        <View>
          <Text style={{ color: PeacockColors.muted, fontSize: 12 }}>Budget/Creator</Text>
          <Text style={{ color: PeacockColors.gold, fontSize: 14, fontWeight: '700', marginTop: 2 }}>
            {item.currency} {item.budget_per_creator || 'N/A'}
          </Text>
        </View>
        <View>
          <Text style={{ color: PeacockColors.muted, fontSize: 12 }}>Responses</Text>
          <Text style={{ color: PeacockColors.teal, fontSize: 14, fontWeight: '700', marginTop: 2 }}>
            {item.interested_count} creators
          </Text>
        </View>
      </View>
    </Card>
  );

  const isLoading = isBrand ? campaignsLoading : dealsLoading;
  const isRefetching = isBrand ? campaignsRefetching : dealsRefetching;
  const onRefresh = isBrand ? refetchCampaigns : refetchDeals;

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: PeacockColors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={PeacockColors.teal} />
        <Text style={{ color: PeacockColors.muted, marginTop: 12, fontSize: 14 }}>
          Loading {isBrand ? 'campaigns' : 'brand deals'}…
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: PeacockColors.bg, paddingHorizontal: 16, paddingTop: 12 }}>
      {isBrand ? (
        <FlatList
          data={campaignsData || []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCampaignItem}
          contentContainerStyle={{ maxWidth: 640, width: '100%', alignSelf: 'center', paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={PeacockColors.teal}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Briefcase size={36} color={PeacockColors.muted} />
              <Text style={{ color: PeacockColors.text, fontSize: 16, fontWeight: '600', marginTop: 12 }}>
                No active campaigns
              </Text>
              <Text style={{ color: PeacockColors.muted, fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 }}>
                Create a campaign with your fee and deliverables to start receiving creator applications.
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={dealsData?.opportunities || []}
          keyExtractor={(item) => item.opportunity_id}
          renderItem={renderDealItem}
          contentContainerStyle={{ maxWidth: 640, width: '100%', alignSelf: 'center', paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={PeacockColors.teal}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Briefcase size={36} color={PeacockColors.muted} />
              <Text style={{ color: PeacockColors.text, fontSize: 16, fontWeight: '600', marginTop: 12 }}>
                No deals found yet
              </Text>
              <Text style={{ color: PeacockColors.muted, fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 }}>
                Complete your profile and link your social handles to get AI-matched opportunities.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
