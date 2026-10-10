import React from 'react';
import {
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Clapperboard,
  Compass,
  Megaphone,
  Sparkles,
  TrendingUp,
  Users,
  WandSparkles,
} from 'lucide-react-native';
import { useAuth } from '../../lib/auth-context';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PeacockColors } from '../../constants/Colors';

export default function StudioScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isBrand = user?.role === 'BRAND';

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
      showsVerticalScrollIndicator={false}
    >
      {/* Header Banner */}
      <View style={{ marginBottom: 24, marginTop: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text
            style={{
              color: PeacockColors.text,
              fontSize: 28,
              fontWeight: '800',
              letterSpacing: -0.5,
            }}
          >
            {isBrand ? 'Brand Studio' : 'Creator Studio'}
          </Text>
          <Badge
            label={user?.role || 'CREATOR'}
            variant={isBrand ? 'blue' : 'teal'}
          />
        </View>
        <Text style={{ color: PeacockColors.muted, fontSize: 15, lineHeight: 22 }}>
          {isBrand
            ? 'Smarter collaborations powered by Gemini AI.'
            : 'Everything creators need to grow with AI.'}
        </Text>
      </View>

      {/* Primary Action Cards */}
      <View style={{ gap: 16 }}>
        {!isBrand ? (
          <>
            {/* Creator Card 1: Brand Deals */}
            <Card elevated>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
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
                <Badge label="AI Matched" variant="teal" />
              </View>
              <Text style={{ color: PeacockColors.muted, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
                Discover curated opportunities matched to your audience. Review compensation and deliverables.
              </Text>
              <Button
                title="View Deals"
                variant="primary"
                onPress={() => router.push('/(tabs)/deals')}
              />
            </Card>

            {/* Creator Card 2: AI Growth Analyzer */}
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
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
                    Growth Analyzer
                  </Text>
                </View>
                <Badge label="Insights" variant="blue" />
              </View>
              <Text style={{ color: PeacockColors.muted, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
                Analyze your Instagram and YouTube performance, view your Authenticity Score, and get AI recommendations.
              </Text>
              <Button
                title="View Analytics"
                variant="secondary"
                onPress={() => router.push('/modal')}
              />
            </Card>

            {/* Creator Card 3: Crewaa Crew (Coming Soon) */}
            <Card style={{ opacity: 0.85 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
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
            <Card elevated>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
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
                <Badge label="AI Ranked" variant="teal" />
              </View>
              <Text style={{ color: PeacockColors.muted, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
                Find verified creators scored for authenticity and ranked to match your campaign goals.
              </Text>
              <Button
                title="Discover Creators"
                variant="primary"
                onPress={() => router.push('/modal')}
              />
            </Card>

            {/* Brand Card 2: Manage Campaigns */}
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
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
                <Badge label="Active" variant="gold" />
              </View>
              <Text style={{ color: PeacockColors.muted, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
                State your budget, deliverables, and timeline. Creators see clear expectations.
              </Text>
              <Button
                title="Manage Campaigns"
                variant="secondary"
                onPress={() => router.push('/(tabs)/deals')}
              />
            </Card>

            {/* Brand Card 3: Interested Creators */}
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
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
                    Responses
                  </Text>
                </View>
                <Badge label="Inbound" variant="blue" />
              </View>
              <Text style={{ color: PeacockColors.muted, fontSize: 14, lineHeight: 20 }}>
                Creators who expressed interest in your campaigns. Review profiles and negotiate terms.
              </Text>
            </Card>
          </>
        )}

        {/* Marketing Suite (Shared Coming Soon) */}
        <Card style={{ opacity: 0.85 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
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
