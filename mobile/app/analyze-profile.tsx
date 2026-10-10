import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clapperboard,
  Compass,
  Lightbulb,
  RotateCw,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react-native';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PeacockColors } from '../constants/Colors';
import { CreatorSummary } from '../types';

export default function AnalyzeProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cached creator summary
  const {
    data: summary,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['creator-summary'],
    queryFn: async () => {
      const res = await api.get<CreatorSummary | null>('/ai/creator-summary');
      return res.data;
    },
    enabled: !!user && user?.role === 'INFLUENCER',
  });

  const handleGenerateSummary = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      await api.post('/ai/creator-summary');
      refetch();
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to analyze profile.');
    } finally {
      setAnalyzing(false);
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
      <View style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: PeacockColors.text, fontSize: 26, fontWeight: '800' }}>
            AI Growth Analyzer
          </Text>
          {summary ? (
            <Button
              title={analyzing ? 'Analyzing…' : 'Re-Analyze'}
              variant="outline"
              loading={analyzing}
              icon={!analyzing ? <RotateCw size={14} color={PeacockColors.text} /> : undefined}
              onPress={handleGenerateSummary}
              style={{ paddingVertical: 6, paddingHorizontal: 12 }}
            />
          ) : null}
        </View>
        <Text style={{ color: PeacockColors.muted, fontSize: 14, marginTop: 4 }}>
          Gemini AI evaluation of your profile strengths, content opportunities, and brand fit.
        </Text>
      </View>

      {/* Error Banner */}
      {error ? (
        <View style={{ backgroundColor: 'rgba(242, 113, 107, 0.15)', padding: 14, borderRadius: 12, marginBottom: 16 }}>
          <Text style={{ color: PeacockColors.danger, fontSize: 13 }}>{error}</Text>
        </View>
      ) : null}

      {/* Loading state */}
      {isLoading ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={PeacockColors.teal} />
          <Text style={{ color: PeacockColors.muted, marginTop: 12, fontSize: 13 }}>
            Loading creator analysis…
          </Text>
        </View>
      ) : !summary ? (
        /* Empty State -> CTA to Analyze */
        <Card elevated style={{ alignItems: 'center', padding: 36 }}>
          <View
            style={{
              height: 64,
              width: 64,
              borderRadius: 32,
              backgroundColor: 'rgba(38, 189, 176, 0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Sparkles size={32} color={PeacockColors.teal} />
          </View>
          <Text style={{ color: PeacockColors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
            Analyze Your Creator Profile
          </Text>
          <Text style={{ color: PeacockColors.muted, fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 20 }}>
            Our AI reviews your public engagement patterns, content consistency, and audience retention to generate personalized tips and ideal brand partnerships.
          </Text>
          <Button
            title={analyzing ? 'Analyzing Profile…' : 'Generate AI Growth Report'}
            variant="primary"
            loading={analyzing}
            icon={!analyzing ? <Zap size={16} color={PeacockColors.onTeal} /> : undefined}
            onPress={handleGenerateSummary}
            style={{ width: '100%' }}
          />
        </Card>
      ) : (
        /* Summary Content */
        <View style={{ gap: 16 }}>
          {/* Stale notice */}
          {summary.is_stale ? (
            <Card style={{ backgroundColor: 'rgba(216, 180, 90, 0.12)', borderColor: 'rgba(216, 180, 90, 0.35)', borderWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <AlertCircle size={18} color={PeacockColors.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: PeacockColors.gold, fontSize: 13, fontWeight: '700' }}>
                    New Scrape Data Available
                  </Text>
                  <Text style={{ color: PeacockColors.muted, fontSize: 12, marginTop: 1 }}>
                    Your stats have updated since this analysis was generated.
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}

          {/* Executive Summary */}
          {summary.summary ? (
            <Card elevated style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} color={PeacockColors.teal} />
                <Text style={{ color: PeacockColors.text, fontSize: 17, fontWeight: '700' }}>
                  AI Profile Overview
                </Text>
              </View>
              <Text style={{ color: PeacockColors.text, fontSize: 14, lineHeight: 22 }}>
                {summary.summary}
              </Text>
              {summary.generated_at ? (
                <Text style={{ color: PeacockColors.muted, fontSize: 11, marginTop: 4 }}>
                  Generated on {new Date(summary.generated_at).toLocaleDateString()}
                </Text>
              ) : null}
            </Card>
          ) : null}

          {/* Key Strengths */}
          {summary.strengths && summary.strengths.length > 0 ? (
            <Card elevated style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} color={PeacockColors.ok} />
                <Text style={{ color: PeacockColors.text, fontSize: 17, fontWeight: '700' }}>
                  Key Strengths
                </Text>
              </View>
              <View style={{ gap: 8 }}>
                {summary.strengths.map((str, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: PeacockColors.deep, padding: 12, borderRadius: 10 }}>
                    <Text style={{ color: PeacockColors.ok, fontWeight: '800', marginTop: 1 }}>✓</Text>
                    <Text style={{ color: PeacockColors.text, fontSize: 13, flex: 1, lineHeight: 18 }}>
                      {str}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {/* Areas for Improvement */}
          {summary.improvement_areas && summary.improvement_areas.length > 0 ? (
            <Card elevated style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Target size={18} color={PeacockColors.gold} />
                <Text style={{ color: PeacockColors.text, fontSize: 17, fontWeight: '700' }}>
                  Growth Opportunities
                </Text>
              </View>
              <View style={{ gap: 8 }}>
                {summary.improvement_areas.map((imp, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: PeacockColors.deep, padding: 12, borderRadius: 10 }}>
                    <Text style={{ color: PeacockColors.gold, fontWeight: '800', marginTop: 1 }}>→</Text>
                    <Text style={{ color: PeacockColors.text, fontSize: 13, flex: 1, lineHeight: 18 }}>
                      {imp}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {/* Best Brand Categories */}
          {summary.best_brand_categories && summary.best_brand_categories.length > 0 ? (
            <Card elevated style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Tag size={18} color={PeacockColors.blue} />
                <Text style={{ color: PeacockColors.text, fontSize: 17, fontWeight: '700' }}>
                  Best Match Brand Industries
                </Text>
              </View>
              <Text style={{ color: PeacockColors.muted, fontSize: 13 }}>
                Brands in these categories have the highest conversion with your audience.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {summary.best_brand_categories.map((cat, idx) => (
                  <View
                    key={idx}
                    style={{
                      backgroundColor: 'rgba(79, 179, 217, 0.15)',
                      borderColor: 'rgba(79, 179, 217, 0.35)',
                      borderWidth: 1,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                    }}
                  >
                    <Text style={{ color: PeacockColors.blue, fontSize: 13, fontWeight: '700' }}>
                      {cat}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {/* Recommended Content Formats */}
          {summary.recommended_content_formats && summary.recommended_content_formats.length > 0 ? (
            <Card elevated style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Lightbulb size={18} color="#B49CF0" />
                <Text style={{ color: PeacockColors.text, fontSize: 17, fontWeight: '700' }}>
                  Recommended Content Formats
                </Text>
              </View>
              <View style={{ gap: 8 }}>
                {summary.recommended_content_formats.map((fmt, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: PeacockColors.deep, padding: 12, borderRadius: 10 }}>
                    <Clapperboard size={16} color="#B49CF0" style={{ marginTop: 2 }} />
                    <Text style={{ color: PeacockColors.text, fontSize: 13, flex: 1, lineHeight: 18 }}>
                      {fmt}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}
