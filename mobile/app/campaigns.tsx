import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
  Check,
  ChevronDown,
  DollarSign,
  IndianRupee,
  Megaphone,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react-native';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PeacockColors } from '../constants/Colors';
import { Campaign, CampaignInput } from '../types';

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
];

const GOALS = ['Awareness', 'Sales', 'Engagement'];
const TYPES = ['Sponsored Reel', 'Sponsored Post', 'Product Review', 'Brand Ambassador'];

const EMPTY_CAMPAIGN: CampaignInput = {
  name: '',
  niche: 'Tech',
  campaign_goal: 'Awareness',
  campaign_type: 'Sponsored Reel',
  budget_per_creator: null,
  currency: 'INR',
  deliverables: ['1x Reel', '2x Stories'],
  deadline: null,
  brief: '',
  platform_preferences: ['instagram'],
  target_location: 'India',
  min_followers: null,
  creators_needed: 3,
};

export default function CampaignsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'closed'>('all');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CampaignInput>(EMPTY_CAMPAIGN);
  const [deliverableInput, setDeliverableInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const {
    data: campaigns,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['brand-campaigns-list'],
    queryFn: async () => {
      const res = await api.get<Campaign[]>('/campaigns');
      return res.data;
    },
    enabled: !!user && user?.role === 'BRAND',
  });

  const filteredCampaigns = (campaigns || []).filter((c) => {
    if (filterStatus === 'active') return c.status === 'active';
    if (filterStatus === 'closed') return c.status === 'closed';
    return true;
  });

  const handleAddDeliverable = () => {
    if (!deliverableInput.trim()) return;
    const current = form.deliverables || [];
    setForm({ ...form, deliverables: [...current, deliverableInput.trim()] });
    setDeliverableInput('');
  };

  const handleRemoveDeliverable = (index: number) => {
    const current = form.deliverables || [];
    setForm({ ...form, deliverables: current.filter((_, i) => i !== index) });
  };

  const handleCreateCampaign = async () => {
    if (!form.name.trim()) {
      setError('Campaign name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.post('/campaigns', form);
      setShowModal(false);
      setForm(EMPTY_CAMPAIGN);
      refetch();
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to create campaign.');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseCampaign = async (id: number) => {
    try {
      await api.delete(`/campaigns/${id}`);
      refetch();
    } catch (err: any) {
      console.warn('Could not close campaign', err);
    }
  };

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
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: PeacockColors.text, fontSize: 26, fontWeight: '800' }}>
            Campaigns
          </Text>
          <Button
            title="New Campaign"
            variant="primary"
            icon={<Plus size={16} color={PeacockColors.onTeal} />}
            onPress={() => setShowModal(true)}
            style={{ paddingVertical: 8, paddingHorizontal: 12 }}
          />
        </View>
        <Text style={{ color: PeacockColors.muted, fontSize: 14, marginTop: 4 }}>
          State your real deliverables, fees, and requirements. Creators see exactly what you offer.
        </Text>
      </View>

      {/* Filter Tabs */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: PeacockColors.deep,
          borderRadius: 12,
          padding: 4,
          marginBottom: 18,
          borderWidth: 1,
          borderColor: PeacockColors.line,
        }}
      >
        {(['all', 'active', 'closed'] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setFilterStatus(tab)}
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: 'center',
              borderRadius: 8,
              backgroundColor: filterStatus === tab ? PeacockColors.surface : 'transparent',
            }}
          >
            <Text
              style={{
                color: filterStatus === tab ? PeacockColors.text : PeacockColors.muted,
                fontSize: 13,
                fontWeight: '700',
                textTransform: 'capitalize',
              }}
            >
              {tab} ({tab === 'all' ? (campaigns?.length || 0) : (campaigns?.filter(c => c.status === tab).length || 0)})
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Campaigns List */}
      {isLoading ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={PeacockColors.teal} />
          <Text style={{ color: PeacockColors.muted, marginTop: 12, fontSize: 13 }}>
            Loading campaigns…
          </Text>
        </View>
      ) : filteredCampaigns.length === 0 ? (
        <Card style={{ alignItems: 'center', padding: 36 }}>
          <Megaphone size={40} color={PeacockColors.muted} />
          <Text style={{ color: PeacockColors.text, fontSize: 17, fontWeight: '700', marginTop: 12 }}>
            No Campaigns Found
          </Text>
          <Text style={{ color: PeacockColors.muted, fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 18 }}>
            Create a campaign with clear deliverables to start attracting matched creators.
          </Text>
          <Button
            title="Create Campaign Now"
            variant="primary"
            onPress={() => setShowModal(true)}
          />
        </Card>
      ) : (
        <View style={{ gap: 14 }}>
          {filteredCampaigns.map((c) => (
            <Card key={c.id} elevated style={{ gap: 12 }}>
              {/* Top Row: Name and status badge */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ color: PeacockColors.text, fontSize: 18, fontWeight: '700' }}>
                    {c.name}
                  </Text>
                  <Text style={{ color: PeacockColors.muted, fontSize: 12, marginTop: 2 }}>
                    {c.niche} • {c.campaign_type} • {c.campaign_goal}
                  </Text>
                </View>
                <Badge
                  label={c.status.toUpperCase()}
                  variant={c.status === 'active' ? 'ok' : 'muted'}
                />
              </View>

              {/* Commercials Bar */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, backgroundColor: PeacockColors.deep, padding: 12, borderRadius: 10 }}>
                {c.budget_per_creator != null ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <IndianRupee size={14} color={PeacockColors.ok} />
                    <Text style={{ color: PeacockColors.ok, fontSize: 13, fontWeight: '700' }}>
                      ₹{c.budget_per_creator.toLocaleString()} / creator
                    </Text>
                  </View>
                ) : null}

                {c.deadline ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Calendar size={14} color={PeacockColors.muted} />
                    <Text style={{ color: PeacockColors.muted, fontSize: 13 }}>
                      Due {new Date(c.deadline).toLocaleDateString()}
                    </Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Users size={14} color={PeacockColors.teal} />
                  <Text style={{ color: PeacockColors.teal, fontSize: 13, fontWeight: '700' }}>
                    {c.interested_count} interested
                  </Text>
                </View>
              </View>

              {/* Deliverables */}
              {c.deliverables && c.deliverables.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {c.deliverables.map((d, idx) => (
                    <View key={idx} style={{ backgroundColor: PeacockColors.deep, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: PeacockColors.line }}>
                      <Text style={{ color: PeacockColors.text, fontSize: 11 }}>{d}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Brief */}
              {c.brief ? (
                <Text style={{ color: PeacockColors.muted, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
                  {c.brief}
                </Text>
              ) : null}

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <Button
                  title={`View Responses (${c.interested_count})`}
                  variant="primary"
                  icon={<Users size={14} color={PeacockColors.onTeal} />}
                  onPress={() => router.push('/interested-creators' as any)}
                  style={{ flex: 1 }}
                />
                {c.status === 'active' ? (
                  <Button
                    title="Close"
                    variant="outline"
                    onPress={() => handleCloseCampaign(c.id)}
                    style={{ paddingHorizontal: 16 }}
                  />
                ) : null}
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* CREATE CAMPAIGN MODAL */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(4, 18, 26, 0.85)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: PeacockColors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderColor: PeacockColors.line,
              maxHeight: '90%',
              padding: 20,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: PeacockColors.text, fontSize: 20, fontWeight: '800' }}>
                Create New Campaign
              </Text>
              <Pressable onPress={() => setShowModal(false)} style={{ padding: 4 }}>
                <X size={22} color={PeacockColors.muted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
              {error ? (
                <View style={{ backgroundColor: 'rgba(242, 113, 107, 0.15)', padding: 12, borderRadius: 10 }}>
                  <Text style={{ color: PeacockColors.danger, fontSize: 13 }}>{error}</Text>
                </View>
              ) : null}

              <Input
                label="Campaign Name *"
                placeholder="e.g. Summer Fitness App Launch"
                value={form.name}
                onChangeText={(val) => setForm({ ...form, name: val })}
              />

              {/* Niche Selection */}
              <View>
                <Text style={{ color: PeacockColors.text, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
                  Niche / Category
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {NICHES.map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => setForm({ ...form, niche: n })}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: form.niche === n ? PeacockColors.teal : PeacockColors.line,
                        backgroundColor: form.niche === n ? PeacockColors.teal : PeacockColors.deep,
                      }}
                    >
                      <Text style={{ color: form.niche === n ? PeacockColors.onTeal : PeacockColors.text, fontSize: 12, fontWeight: '600' }}>
                        {n}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Collab Type */}
              <View>
                <Text style={{ color: PeacockColors.text, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
                  Collaboration Format
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {TYPES.map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setForm({ ...form, campaign_type: t })}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: form.campaign_type === t ? PeacockColors.gold : PeacockColors.line,
                        backgroundColor: form.campaign_type === t ? 'rgba(216, 180, 90, 0.15)' : PeacockColors.deep,
                      }}
                    >
                      <Text style={{ color: form.campaign_type === t ? PeacockColors.gold : PeacockColors.muted, fontSize: 12, fontWeight: '700' }}>
                        {t}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Input
                label="Budget per Creator (INR)"
                placeholder="e.g. 25000"
                keyboardType="numeric"
                value={form.budget_per_creator != null ? String(form.budget_per_creator) : ''}
                onChangeText={(val) => setForm({ ...form, budget_per_creator: val ? Number(val) : null })}
              />

              {/* Deliverables builder */}
              <View>
                <Text style={{ color: PeacockColors.text, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
                  Deliverables
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      placeholder="e.g. 1x Reel with sound"
                      value={deliverableInput}
                      onChangeText={setDeliverableInput}
                    />
                  </View>
                  <Button
                    title="Add"
                    variant="secondary"
                    onPress={handleAddDeliverable}
                    style={{ alignSelf: 'flex-start' }}
                  />
                </View>

                {form.deliverables && form.deliverables.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {form.deliverables.map((d, i) => (
                      <Pressable
                        key={i}
                        onPress={() => handleRemoveDeliverable(i)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: PeacockColors.deep, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                      >
                        <Text style={{ color: PeacockColors.text, fontSize: 12 }}>{d}</Text>
                        <X size={12} color={PeacockColors.muted} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>

              <Input
                label="Campaign Brief / Instructions"
                placeholder="Describe key messages, hashtags, do's and don'ts…"
                multiline
                numberOfLines={3}
                value={form.brief || ''}
                onChangeText={(val) => setForm({ ...form, brief: val })}
                style={{ minHeight: 70, textAlignVertical: 'top' }}
              />

              <Button
                title={saving ? 'Creating Campaign…' : 'Publish Campaign'}
                variant="primary"
                loading={saving}
                onPress={handleCreateCampaign}
                style={{ marginTop: 8 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
