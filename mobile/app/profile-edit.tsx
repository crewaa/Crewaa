import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Globe, MapPin, Sparkles, Tag, User } from 'lucide-react-native';
import { InstagramIcon, YoutubeIcon } from '../components/icons/SocialIcons';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PeacockColors } from '../constants/Colors';
import { CreatorProfile, BrandProfile } from '../types';

const CATEGORIES = [
  'Fashion & Beauty',
  'Tech & Gadgets',
  'Fitness & Wellness',
  'Gaming & Esports',
  'Travel & Tourism',
  'Food & Cooking',
  'Education & Career',
  'Finance & Crypto',
  'Entertainment & Comedy',
  'Lifestyle & Vlogging',
];

const INDUSTRIES = [
  'Fashion & Beauty',
  'Technology',
  'Fitness & Nutrition',
  'Gaming',
  'Food & Beverage',
  'Travel & Tourism',
  'Education',
  'Finance',
  'E-commerce',
  'SaaS & Software',
  'Entertainment',
  'Health & Wellness',
];

const CAMPAIGN_GOALS = [
  'Brand Awareness',
  'Product Launch',
  'Lead Generation',
  'Direct Sales',
  'Content Creation',
];

const BUDGET_RANGES = [
  'Under ₹25,000',
  '₹25,000 - ₹1,00,000',
  '₹1,00,000 - ₹5,00,000',
  '₹5,00,000+',
];

export default function ProfileEditScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isBrand = user?.role === 'BRAND';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [profileExists, setProfileExists] = useState(false);

  // Creator profile state
  const [fullName, setFullName] = useState('');
  const [location, setLocation] = useState('');
  const [primaryPlatform, setPrimaryPlatform] = useState('Instagram');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [instagramUsername, setInstagramUsername] = useState('');
  const [instagramLink, setInstagramLink] = useState('');
  const [youtubeUsername, setYoutubeUsername] = useState('');
  const [youtubeLink, setYoutubeLink] = useState('');
  const [bio, setBio] = useState('');

  // Brand profile state
  const [brandName, setBrandName] = useState('');
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [campaignGoal, setCampaignGoal] = useState(CAMPAIGN_GOALS[0]);
  const [budgetRange, setBudgetRange] = useState(BUDGET_RANGES[1]);
  const [targetLocation, setTargetLocation] = useState('');

  useEffect(() => {
    async function loadProfile() {
      try {
        if (isBrand) {
          const res = await api.get<BrandProfile>('/users/brand-profile');
          if (res.data) {
            setProfileExists(true);
            setBrandName(res.data.brand_name || '');
            setIndustry(res.data.industry || INDUSTRIES[0]);
            setDescription(res.data.description || '');
            setWebsite(res.data.website || '');
            setCampaignGoal(res.data.campaign_goal || CAMPAIGN_GOALS[0]);
            setBudgetRange(res.data.budget_range || BUDGET_RANGES[1]);
            setTargetLocation(res.data.target_location || '');
          }
        } else {
          const res = await api.get<CreatorProfile>('/users/creator-profile');
          if (res.data) {
            setProfileExists(true);
            setFullName(res.data.full_name || '');
            setLocation(res.data.location || '');
            setPrimaryPlatform(res.data.primary_platform || 'Instagram');
            setCategory(res.data.category || CATEGORIES[0]);
            setInstagramUsername(res.data.instagram_username || '');
            setInstagramLink(res.data.instagram_profile_link || '');
            setYoutubeUsername(res.data.youtube_username || '');
            setYoutubeLink(res.data.youtube_profile_link || '');
            setBio(res.data.bio || '');
          }
        }
      } catch {
        // No existing profile -> create mode
        setProfileExists(false);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [isBrand]);

  const handleSaveCreator = async () => {
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!location.trim()) {
      setError('Please enter your location.');
      return;
    }
    if (!instagramUsername.trim() && !youtubeUsername.trim()) {
      setError('Please provide at least one social handle (Instagram or YouTube).');
      return;
    }

    setError('');
    setSaving(true);
    setSuccessMsg('');

    const payload = {
      full_name: fullName.trim(),
      location: location.trim(),
      primary_platform: primaryPlatform,
      category,
      instagram_username: instagramUsername.trim().replace(/^@/, '') || null,
      instagram_profile_link: instagramLink.trim() || null,
      youtube_username: youtubeUsername.trim().replace(/^@/, '') || null,
      youtube_profile_link: youtubeLink.trim() || null,
      bio: bio.trim() || null,
    };

    try {
      if (profileExists) {
        await api.put('/users/creator-profile', payload);
      } else {
        await api.post('/users/creator-profile', payload);
      }
      setProfileExists(true);
      setSuccessMsg('Profile saved! We are fetching your social stats and calculating your Authenticity Score.');
      setTimeout(() => {
        router.push('/analytics' as any);
      }, 1200);
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to save creator profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBrand = async () => {
    if (!brandName.trim()) {
      setError('Please enter your brand name.');
      return;
    }

    setError('');
    setSaving(true);
    setSuccessMsg('');

    const payload = {
      brand_name: brandName.trim(),
      industry,
      description: description.trim() || null,
      website: website.trim() || null,
      campaign_goal: campaignGoal,
      budget_range: budgetRange,
      target_location: targetLocation.trim() || null,
      target_languages: JSON.stringify(['English', 'Hindi']),
      platform_preferences: JSON.stringify(['Instagram', 'YouTube']),
    };

    try {
      if (profileExists) {
        await api.put('/users/brand-profile', payload);
      } else {
        await api.post('/users/brand-profile', payload);
      }
      setProfileExists(true);
      setSuccessMsg('Brand profile saved successfully!');
      setTimeout(() => {
        router.back();
      }, 1000);
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to save brand profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: PeacockColors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={PeacockColors.teal} />
        <Text style={{ color: PeacockColors.muted, marginTop: 12, fontSize: 14 }}>
          Loading profile…
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: PeacockColors.bg }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 48,
          maxWidth: 600,
          width: '100%',
          alignSelf: 'center',
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: PeacockColors.text, fontSize: 26, fontWeight: '800' }}>
              {isBrand ? 'Brand Profile' : 'Creator Profile'}
            </Text>
            <Badge
              label={profileExists ? 'Editing' : 'New Profile'}
              variant={profileExists ? 'ok' : 'gold'}
            />
          </View>
          <Text style={{ color: PeacockColors.muted, fontSize: 14 }}>
            {isBrand
              ? 'Tell creators about your brand, goals, and budget to get matched.'
              : 'Add your identity & social handles so we can scrape stats and compute your Authenticity Score.'}
          </Text>
        </View>

        {error ? (
          <View
            style={{
              backgroundColor: 'rgba(242, 113, 107, 0.15)',
              borderColor: 'rgba(242, 113, 107, 0.35)',
              borderWidth: 1,
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: PeacockColors.danger, fontSize: 13, fontWeight: '500' }}>
              {error}
            </Text>
          </View>
        ) : null}

        {successMsg ? (
          <View
            style={{
              backgroundColor: 'rgba(134, 211, 107, 0.15)',
              borderColor: 'rgba(134, 211, 107, 0.35)',
              borderWidth: 1,
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: PeacockColors.ok, fontSize: 13, fontWeight: '600' }}>
              {successMsg}
            </Text>
          </View>
        ) : null}

        {!isBrand ? (
          /* ================= CREATOR FORM ================= */
          <View style={{ gap: 16 }}>
            {/* Identity Card */}
            <Card elevated>
              <Text style={{ color: PeacockColors.text, fontSize: 17, fontWeight: '700', marginBottom: 14 }}>
                Personal Information
              </Text>

              <Input
                label="Full Name *"
                placeholder="e.g. Sameer Sharma"
                value={fullName}
                onChangeText={setFullName}
              />

              <Input
                label="Location (City, Country) *"
                placeholder="e.g. Mumbai, India"
                value={location}
                onChangeText={setLocation}
              />

              {/* Primary Platform Selector */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
                  Primary Platform
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {['Instagram', 'YouTube', 'Both'].map((plat) => (
                    <Pressable
                      key={plat}
                      onPress={() => setPrimaryPlatform(plat)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        alignItems: 'center',
                        backgroundColor:
                          primaryPlatform === plat ? 'rgba(38, 189, 176, 0.15)' : PeacockColors.deep,
                        borderColor:
                          primaryPlatform === plat ? PeacockColors.teal : PeacockColors.line,
                      }}
                    >
                      <Text
                        style={{
                          color: primaryPlatform === plat ? PeacockColors.teal : PeacockColors.muted,
                          fontSize: 13,
                          fontWeight: '700',
                        }}
                      >
                        {plat}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Category Picker */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
                  Content Category
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setCategory(cat)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        borderRadius: 20,
                        borderWidth: 1,
                        backgroundColor: category === cat ? PeacockColors.teal : PeacockColors.deep,
                        borderColor: category === cat ? PeacockColors.teal : PeacockColors.line,
                      }}
                    >
                      <Text
                        style={{
                          color: category === cat ? PeacockColors.onTeal : PeacockColors.text,
                          fontSize: 12,
                          fontWeight: '600',
                        }}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <Input
                label="Bio / About Yourself"
                placeholder="Tell brands about your audience and content style…"
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={3}
                style={{ minHeight: 70, textAlignVertical: 'top' }}
              />
            </Card>

            {/* Social Handles Card (Crucial for Scraping) */}
            <Card elevated>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Sparkles size={20} color={PeacockColors.teal} />
                <Text style={{ color: PeacockColors.text, fontSize: 17, fontWeight: '700' }}>
                  Connected Social Channels
                </Text>
              </View>
              <Text style={{ color: PeacockColors.muted, fontSize: 13, marginBottom: 16 }}>
                We scrape public stats from these handles to generate your Authenticity Score and Growth Analytics.
              </Text>

              {/* Instagram Handle */}
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <InstagramIcon size={16} color="#E1306C" />
                  <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '600' }}>
                    Instagram Handle
                  </Text>
                </View>
                <Input
                  placeholder="e.g. yourhandle (without @)"
                  value={instagramUsername}
                  onChangeText={setInstagramUsername}
                  autoCapitalize="none"
                />
              </View>

              {/* YouTube Handle */}
              <View style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <YoutubeIcon size={16} color="#FF0000" />
                  <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '600' }}>
                    YouTube Channel / Handle
                  </Text>
                </View>
                <Input
                  placeholder="e.g. channelname or @handle"
                  value={youtubeUsername}
                  onChangeText={setYoutubeUsername}
                  autoCapitalize="none"
                />
              </View>
            </Card>

            <Button
              title={saving ? 'Saving & Triggering Scrape…' : 'Save Creator Profile'}
              variant="primary"
              loading={saving}
              onPress={handleSaveCreator}
              style={{ marginTop: 8 }}
            />
          </View>
        ) : (
          /* ================= BRAND FORM ================= */
          <View style={{ gap: 16 }}>
            <Card elevated>
              <Text style={{ color: PeacockColors.text, fontSize: 17, fontWeight: '700', marginBottom: 14 }}>
                Brand Details
              </Text>

              <Input
                label="Brand / Company Name *"
                placeholder="e.g. Nike, Boat, etc."
                value={brandName}
                onChangeText={setBrandName}
              />

              {/* Industry Selector */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
                  Industry
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {INDUSTRIES.map((ind) => (
                    <Pressable
                      key={ind}
                      onPress={() => setIndustry(ind)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        borderRadius: 20,
                        borderWidth: 1,
                        backgroundColor: industry === ind ? PeacockColors.blue : PeacockColors.deep,
                        borderColor: industry === ind ? PeacockColors.blue : PeacockColors.line,
                      }}
                    >
                      <Text
                        style={{
                          color: industry === ind ? '#FFFFFF' : PeacockColors.text,
                          fontSize: 12,
                          fontWeight: '600',
                        }}
                      >
                        {ind}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <Input
                label="Website URL"
                placeholder="https://yourbrand.com"
                value={website}
                onChangeText={setWebsite}
                autoCapitalize="none"
                keyboardType="url"
              />

              <Input
                label="Brand Description"
                placeholder="Briefly describe your brand and audience…"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                style={{ minHeight: 70, textAlignVertical: 'top' }}
              />
            </Card>

            <Card elevated>
              <Text style={{ color: PeacockColors.text, fontSize: 17, fontWeight: '700', marginBottom: 14 }}>
                Campaign Preferences
              </Text>

              {/* Campaign Goal */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
                  Primary Campaign Goal
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {CAMPAIGN_GOALS.map((goal) => (
                    <Pressable
                      key={goal}
                      onPress={() => setCampaignGoal(goal)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        borderRadius: 20,
                        borderWidth: 1,
                        backgroundColor: campaignGoal === goal ? PeacockColors.gold : PeacockColors.deep,
                        borderColor: campaignGoal === goal ? PeacockColors.gold : PeacockColors.line,
                      }}
                    >
                      <Text
                        style={{
                          color: campaignGoal === goal ? PeacockColors.deep : PeacockColors.text,
                          fontSize: 12,
                          fontWeight: '600',
                        }}
                      >
                        {goal}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Budget Range */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
                  Typical Budget Range
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {BUDGET_RANGES.map((b) => (
                    <Pressable
                      key={b}
                      onPress={() => setBudgetRange(b)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        backgroundColor: budgetRange === b ? 'rgba(216, 180, 90, 0.15)' : PeacockColors.deep,
                        borderColor: budgetRange === b ? PeacockColors.gold : PeacockColors.line,
                      }}
                    >
                      <Text
                        style={{
                          color: budgetRange === b ? PeacockColors.gold : PeacockColors.text,
                          fontSize: 12,
                          fontWeight: '600',
                        }}
                      >
                        {b}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Input
                label="Target Location"
                placeholder="e.g. India, Tier 1 Cities"
                value={targetLocation}
                onChangeText={setTargetLocation}
              />
            </Card>

            <Button
              title={saving ? 'Saving…' : 'Save Brand Profile'}
              variant="primary"
              loading={saving}
              onPress={handleSaveBrand}
              style={{ marginTop: 8 }}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
