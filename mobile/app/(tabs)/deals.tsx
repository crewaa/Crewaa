import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Bookmark,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  DollarSign,
  IndianRupee,
  LogIn,
  MessageCircle,
  Plus,
  RotateCw,
  Sparkles,
  Users,
  X,
} from 'lucide-react-native';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { Card } from '../../components/ui/Card';
import { Badge, BadgeVariant } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PeacockColors } from '../../constants/Colors';
import { BrandDeal, Campaign, InterestedCreatorsResponse } from '../../types';

export default function DealsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isBrand = user?.role === 'BRAND';

  const [interestedIds, setInterestedIds] = useState<Record<string, boolean>>({});
  const [fetchingFresh, setFetchingFresh] = useState(false);

  // Pitch message modal for creators expressing interest
  const [pitchModalVisible, setPitchModalVisible] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<BrandDeal | null>(null);
  const [pitchMessage, setPitchMessage] = useState('');
  const [submittingInterest, setSubmittingInterest] = useState(false);

  // Query creator brand deals
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

  // Query brand campaigns
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

  // Query inbound responses count for brand
  const { data: interestedData } = useQuery({
    queryKey: ['interested-creators-count'],
    queryFn: async () => {
      const res = await api.get<InterestedCreatorsResponse>('/ai/interested-creators');
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

  const handleFreshDeals = async () => {
    setFetchingFresh(true);
    try {
      await api.post('/ai/brand-deals');
      refetchDeals();
    } catch (err) {
      console.warn('Failed to fetch fresh deals', err);
    } finally {
      setFetchingFresh(false);
    }
  };

  const handleOpenPitchModal = (deal: BrandDeal) => {
    const isAlreadyInterested = interestedIds[deal.opportunity_id] ?? deal.interested;
    if (isAlreadyInterested) {
      handleWithdrawInterest(deal.opportunity_id);
    } else {
      setSelectedDeal(deal);
      setPitchMessage('');
      setPitchModalVisible(true);
    }
  };

  const handleSubmitInterest = async () => {
    if (!selectedDeal) return;
    setSubmittingInterest(true);
    const oppId = selectedDeal.opportunity_id;

    try {
      await api.post('/ai/opportunities/interest', {
        opportunity_id: oppId,
        message: pitchMessage.trim() || undefined,
        deal_snapshot: selectedDeal,
      });
      setInterestedIds((prev) => ({ ...prev, [oppId]: true }));
      setPitchModalVisible(false);
      setSelectedDeal(null);
      refetchDeals();
    } catch (err) {
      console.warn('Failed to submit interest', err);
    } finally {
      setSubmittingInterest(false);
    }
  };

  const handleWithdrawInterest = async (oppId: string) => {
    setInterestedIds((prev) => ({ ...prev, [oppId]: false }));
    try {
      await api.delete(`/ai/opportunities/interest/${oppId}`);
      refetchDeals();
    } catch {
      setInterestedIds((prev) => ({ ...prev, [oppId]: true }));
    }
  };

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: PeacockColors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
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
      <Card elevated style={{ marginBottom: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
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
              label={item.fit_level.toUpperCase()}
              variant={getFitBadgeVariant(item.fit_level)}
            />
          ) : null}
        </View>

        {item.campaign_requirements ? (
          <Text style={{ color: PeacockColors.text, fontSize: 14, lineHeight: 20 }}>
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
            borderWidth: 1,
            borderColor: PeacockColors.line,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {item.currency === 'INR' ? (
              <IndianRupee size={15} color={PeacockColors.gold} />
            ) : (
              <DollarSign size={15} color={PeacockColors.gold} />
            )}
            <Text style={{ color: PeacockColors.text, fontSize: 13, fontWeight: '500' }}>
              Fee:{' '}
              <Text style={{ color: PeacockColors.gold, fontWeight: '700' }}>
                {item.budget_per_creator != null ? `₹${item.budget_per_creator.toLocaleString()}` : (item.compensation || item.budget_range || 'Competitive')}
              </Text>
            </Text>
          </View>
          {item.deadline ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Calendar size={15} color={PeacockColors.blue} />
              <Text style={{ color: PeacockColors.muted, fontSize: 13 }}>
                Deadline: {new Date(item.deadline).toLocaleDateString()}
              </Text>
            </View>
          ) : item.timeline ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Calendar size={15} color={PeacockColors.blue} />
              <Text style={{ color: PeacockColors.muted, fontSize: 13 }}>
                Timeline: {item.timeline}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Deliverables tags */}
        {item.deliverables && item.deliverables.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {item.deliverables.map((deliv, idx) => (
              <Badge key={idx} label={deliv} variant="muted" />
            ))}
          </View>
        ) : null}

        {/* Why it fits */}
        {item.why_it_fits && item.why_it_fits.length > 0 ? (
          <View style={{ gap: 4 }}>
            {item.why_it_fits.slice(0, 2).map((w, idx) => (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                <Check size={14} color={PeacockColors.teal} style={{ marginTop: 2 }} />
                <Text style={{ color: PeacockColors.muted, fontSize: 12, flex: 1, lineHeight: 16 }}>
                  {w}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Button
          title={isInterested ? 'Interested ✓ (Tap to withdraw)' : "I'm Interested — Apply"}
          variant={isInterested ? 'secondary' : 'primary'}
          icon={isInterested ? <Check size={16} color={PeacockColors.ok} /> : <Sparkles size={16} color={PeacockColors.onTeal} />}
          onPress={() => handleOpenPitchModal(item)}
        />
      </Card>
    );
  };

  const renderCampaignItem = ({ item }: { item: Campaign }) => (
    <Card elevated style={{ marginBottom: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ color: PeacockColors.text, fontSize: 18, fontWeight: '700' }}>
            {item.name}
          </Text>
          <Text style={{ color: PeacockColors.muted, fontSize: 12, marginTop: 2 }}>
            {item.niche} • {item.campaign_type}
          </Text>
        </View>
        <Badge
          label={item.status.toUpperCase()}
          variant={item.status === 'active' ? 'ok' : 'muted'}
        />
      </View>

      <View
        style={{
          borderRadius: 10,
          backgroundColor: PeacockColors.deep,
          padding: 10,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text style={{ color: PeacockColors.muted, fontSize: 11 }}>Budget / Creator</Text>
          <Text style={{ color: PeacockColors.gold, fontSize: 14, fontWeight: '700', marginTop: 2 }}>
            ₹{item.budget_per_creator?.toLocaleString() || 'Flexible'}
          </Text>
        </View>
        <View>
          <Text style={{ color: PeacockColors.muted, fontSize: 11 }}>Inbound Responses</Text>
          <Text style={{ color: PeacockColors.teal, fontSize: 14, fontWeight: '700', marginTop: 2 }}>
            {item.interested_count} creators
          </Text>
        </View>
      </View>

      <Button
        title={`View Responses (${item.interested_count})`}
        variant="primary"
        icon={<Users size={14} color={PeacockColors.onTeal} />}
        onPress={() => router.push('/interested-creators' as any)}
      />
    </Card>
  );

  const isLoading = isBrand ? campaignsLoading : dealsLoading;
  const isRefetching = isBrand ? campaignsRefetching : dealsRefetching;
  const onRefresh = isBrand ? refetchCampaigns : refetchDeals;

  return (
    <View style={{ flex: 1, backgroundColor: PeacockColors.bg, paddingHorizontal: 16, paddingTop: 12 }}>
      {/* Top Banner / Actions */}
      {isBrand ? (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          <Button
            title="Create Campaign"
            variant="primary"
            icon={<Plus size={15} color={PeacockColors.onTeal} />}
            onPress={() => router.push('/campaigns' as any)}
            style={{ flex: 1 }}
          />
          <Button
            title={`Responses (${interestedData?.total || 0})`}
            variant="secondary"
            icon={<Users size={15} color={PeacockColors.text} />}
            onPress={() => router.push('/interested-creators' as any)}
            style={{ flex: 1 }}
          />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingHorizontal: 4 }}>
          <View>
            <Text style={{ color: PeacockColors.text, fontSize: 18, fontWeight: '800' }}>
              Matched Brand Deals
            </Text>
            <Text style={{ color: PeacockColors.muted, fontSize: 12 }}>
              Curated by AI based on your audience metrics
            </Text>
          </View>
          <Button
            title={fetchingFresh ? 'Searching…' : 'Refresh'}
            variant="outline"
            loading={fetchingFresh}
            icon={!fetchingFresh ? <RotateCw size={13} color={PeacockColors.text} /> : undefined}
            onPress={handleFreshDeals}
            style={{ paddingVertical: 6, paddingHorizontal: 10 }}
          />
        </View>
      )}

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={PeacockColors.teal} />
          <Text style={{ color: PeacockColors.muted, marginTop: 12, fontSize: 14 }}>
            Loading {isBrand ? 'campaigns' : 'brand deals'}…
          </Text>
        </View>
      ) : isBrand ? (
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
              <Text style={{ color: PeacockColors.muted, fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 24, marginBottom: 16 }}>
                Create a campaign with your fee and deliverables to start receiving creator applications.
              </Text>
              <Button
                title="Create Campaign"
                variant="primary"
                onPress={() => router.push('/campaigns' as any)}
              />
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
              <Text style={{ color: PeacockColors.muted, fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 24, marginBottom: 16 }}>
                Tap Refresh to ask our AI engine to generate matched brand opportunities for your profile.
              </Text>
              <Button
                title="Find Opportunities"
                variant="primary"
                onPress={handleFreshDeals}
              />
            </View>
          }
        />
      )}

      {/* PITCH MODAL FOR CREATORS */}
      <Modal visible={pitchModalVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(4, 18, 26, 0.85)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: PeacockColors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderColor: PeacockColors.line,
              padding: 20,
              gap: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: PeacockColors.text, fontSize: 18, fontWeight: '800' }}>
                  Express Interest
                </Text>
                <Text style={{ color: PeacockColors.muted, fontSize: 12 }}>
                  {selectedDeal?.industry_hint || 'Collaboration'}
                </Text>
              </View>
              <Pressable onPress={() => setPitchModalVisible(false)} style={{ padding: 4 }}>
                <X size={20} color={PeacockColors.muted} />
              </Pressable>
            </View>

            <Text style={{ color: PeacockColors.text, fontSize: 13, lineHeight: 18 }}>
              Tell the brand why your audience is a strong match for this campaign (optional):
            </Text>

            <TextInput
              placeholder="e.g. I recently reviewed similar products with 8% engagement, and my followers frequently ask for recommendations in this niche…"
              placeholderTextColor={PeacockColors.muted}
              multiline
              numberOfLines={4}
              value={pitchMessage}
              onChangeText={setPitchMessage}
              style={{
                backgroundColor: PeacockColors.deep,
                borderColor: PeacockColors.line,
                borderWidth: 1,
                borderRadius: 12,
                color: PeacockColors.text,
                padding: 12,
                minHeight: 90,
                textAlignVertical: 'top',
                fontSize: 13,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setPitchModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title={submittingInterest ? 'Sending…' : 'Send Application'}
                variant="primary"
                loading={submittingInterest}
                onPress={handleSubmitInterest}
                style={{ flex: 2 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
