import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BarChart3,
  CheckCircle,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Globe,
  LogIn,
  LogOut,
  Mail,
  Shield,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react-native';
import { InstagramIcon, YoutubeIcon } from '../../components/icons/SocialIcons';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PeacockColors } from '../../constants/Colors';
import {
  AuthenticityReportResponse,
  BrandProfile,
  CreatorProfile,
  InstagramAnalyticsResponse,
  ProfileStatus,
} from '../../types';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const isBrand = user?.role === 'BRAND';

  // Profile status query
  const {
    data: statusData,
    isLoading: statusLoading,
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

  // Creator profile data
  const {
    data: creatorData,
    refetch: refetchCreator,
  } = useQuery({
    queryKey: ['creator-profile', user?.id],
    queryFn: async () => {
      const res = await api.get<CreatorProfile>('/users/creator-profile');
      return res.data;
    },
    enabled: !!user && !isBrand,
  });

  // Brand profile data
  const {
    data: brandData,
    refetch: refetchBrand,
  } = useQuery({
    queryKey: ['brand-profile', user?.id],
    queryFn: async () => {
      const res = await api.get<BrandProfile>('/users/brand-profile');
      return res.data;
    },
    enabled: !!user && isBrand,
  });

  // Authenticity score summary query
  const {
    data: authData,
    refetch: refetchAuth,
  } = useQuery({
    queryKey: ['authenticity-summary', user?.id],
    queryFn: async () => {
      const res = await api.get<AuthenticityReportResponse>(`/authenticity/${user?.id}`);
      return res.data;
    },
    enabled: !!user && !isBrand,
  });

  // Instagram profile data (for profile picture)
  const {
    data: igData,
    refetch: refetchIg,
  } = useQuery({
    queryKey: ['ig-analytics', user?.id],
    queryFn: async () => {
      const res = await api.get<InstagramAnalyticsResponse>(`/instagram/analytics/${user?.id}`);
      return res.data;
    },
    enabled: !!user && !isBrand,
  });

  const [avatarImgError, setAvatarImgError] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const handleRefresh = () => {
    refetchStatus();
    if (isBrand) refetchBrand();
    else {
      refetchCreator();
      refetchAuth();
      refetchIg();
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
          <User size={40} color={PeacockColors.teal} />
          <Text style={{ color: PeacockColors.text, fontSize: 20, fontWeight: '700', marginTop: 16 }}>
            Sign In to View Profile
          </Text>
          <Text style={{ color: PeacockColors.muted, fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 20 }}>
            Create an account or sign in to manage your creator stats and brand preferences.
          </Text>
          <Button
            title="Sign In / Register"
            variant="primary"
            icon={<LogIn size={18} color={PeacockColors.onTeal} />}
            onPress={() => router.push('/(auth)/login')}
            style={{ width: '100%' }}
          />
        </Card>
      </View>
    );
  }

  const isComplete = statusData?.is_complete ?? false;
  const hasProfile = statusData?.has_profile ?? false;
  const missingFields = statusData?.missing ?? [];

  const mainReport = authData?.reports?.[0];
  const avatarUrl = isBrand ? brandData?.logo_url : (igData?.profile?.profile_picture || null);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: PeacockColors.bg }}
      contentContainerStyle={{
        padding: 20,
        paddingBottom: 48,
        maxWidth: 600,
        width: '100%',
        alignSelf: 'center',
      }}
      refreshControl={
        <RefreshControl
          refreshing={statusRefetching}
          onRefresh={handleRefresh}
          tintColor={PeacockColors.teal}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* User Header */}
      <View style={{ alignItems: 'center', marginBottom: 20, marginTop: 4 }}>
        {avatarUrl && !avatarImgError ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{
              height: 76,
              width: 76,
              borderRadius: 38,
              borderWidth: 2,
              borderColor: PeacockColors.teal,
              backgroundColor: PeacockColors.surface,
              marginBottom: 10,
            }}
            resizeMode="cover"
            onError={() => setAvatarImgError(true)}
          />
        ) : (
          <View
            style={{
              height: 76,
              width: 76,
              borderRadius: 38,
              backgroundColor: PeacockColors.surface,
              borderWidth: 2,
              borderColor: PeacockColors.teal,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}
          >
            <User size={38} color={PeacockColors.teal} />
          </View>
        )}

        <Text style={{ color: PeacockColors.text, fontSize: 22, fontWeight: '800' }}>
          {isBrand
            ? brandData?.brand_name || 'Brand Profile'
            : creatorData?.full_name || 'Creator Profile'}
        </Text>
        <Text style={{ color: PeacockColors.muted, fontSize: 13, marginTop: 2 }}>
          {user.email}
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Badge
            label={user.role}
            variant={isBrand ? 'blue' : 'teal'}
          />
          {isComplete ? (
            <Badge label="Profile Complete ✓" variant="ok" />
          ) : (
            <Badge label="Needs Setup" variant="warn" />
          )}
        </View>
      </View>

      {/* Profile Completeness Alert Banner */}
      {!isComplete ? (
        <Card
          style={{
            backgroundColor: 'rgba(242, 154, 74, 0.1)',
            borderColor: 'rgba(242, 154, 74, 0.35)',
            borderWidth: 1,
            marginBottom: 20,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <AlertCircle size={22} color={PeacockColors.warn} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: PeacockColors.text, fontSize: 16, fontWeight: '700' }}>
                Complete Your Profile
              </Text>
              <Text style={{ color: PeacockColors.muted, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                {isBrand
                  ? 'Add your industry, website, and goals to match with relevant creators.'
                  : 'Add your location & social handles to unlock AI Brand Deals, scrape stats, and calculate your Authenticity Score.'}
              </Text>

              {missingFields.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {missingFields.map((field, idx) => (
                    <Badge key={idx} label={`Missing: ${field}`} variant="warn" />
                  ))}
                </View>
              ) : null}

              <Button
                title={hasProfile ? 'Complete Profile' : 'Create Profile Now'}
                variant="primary"
                icon={<Edit3 size={15} color={PeacockColors.onTeal} />}
                onPress={() => router.push('/profile-edit' as any)}
                style={{ marginTop: 14, alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 16 }}
              />
            </View>
          </View>
        </Card>
      ) : null}

      {/* ================= CREATOR SOCIAL OVERVIEW CARD ================= */}
      {!isBrand ? (
        <Card elevated style={{ marginBottom: 20 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
              gap: 8,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                flex: 1,
                minWidth: 0,
              }}
            >
              <Sparkles size={18} color={PeacockColors.teal} />
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  color: PeacockColors.text,
                  fontSize: 16,
                  fontWeight: '700',
                  flexShrink: 1,
                }}
              >
                Channels & Signals
              </Text>
            </View>

            <Button
              title="Edit"
              variant="outline"
              size="sm"
              icon={<Edit3 size={13} color={PeacockColors.text} />}
              onPress={() => router.push('/profile-edit' as any)}
            />
          </View>

          {/* Social Handles Status */}
          <View style={{ gap: 10, marginBottom: 16 }}>
            {/* Instagram */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: PeacockColors.deep,
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: PeacockColors.line,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <InstagramIcon size={20} color="#E1306C" />
                <View>
                  <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '600' }}>
                    Instagram
                  </Text>
                  <Text style={{ color: PeacockColors.muted, fontSize: 12 }}>
                    {creatorData?.instagram_username
                      ? `@${creatorData.instagram_username}`
                      : 'Not linked'}
                  </Text>
                </View>
              </View>
              {creatorData?.instagram_username ? (
                <Badge label="Linked ✓" variant="ok" />
              ) : (
                <Badge label="Add Handle" variant="muted" />
              )}
            </View>

            {/* YouTube */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: PeacockColors.deep,
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: PeacockColors.line,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <YoutubeIcon size={20} color="#FF0000" />
                <View>
                  <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '600' }}>
                    YouTube
                  </Text>
                  <Text style={{ color: PeacockColors.muted, fontSize: 12 }}>
                    {creatorData?.youtube_username
                      ? creatorData.youtube_username
                      : 'Not linked'}
                  </Text>
                </View>
              </View>
              {creatorData?.youtube_username ? (
                <Badge label="Linked ✓" variant="ok" />
              ) : (
                <Badge label="Add Channel" variant="muted" />
              )}
            </View>
          </View>

          {/* Authenticity Score Teaser */}
          <View
            style={{
              backgroundColor: 'rgba(38, 189, 176, 0.1)',
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: 'rgba(38, 189, 176, 0.3)',
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={26} color={PeacockColors.teal} />
                <View>
                  <Text style={{ color: PeacockColors.text, fontSize: 15, fontWeight: '700' }}>
                    Authenticity Score
                  </Text>
                  <Text style={{ color: PeacockColors.teal, fontSize: 13, fontWeight: '600' }}>
                    {mainReport?.score != null ? `${mainReport.score} / 100` : 'Not computed yet'}
                  </Text>
                </View>
              </View>
              {mainReport ? (
                <Badge
                  label={mainReport.level.toUpperCase()}
                  variant={mainReport.level === 'high' ? 'ok' : 'gold'}
                />
              ) : null}
            </View>
          </View>

          <Button
            title="View Full Analytics & Scrape Data"
            variant="primary"
            icon={<BarChart3 size={16} color={PeacockColors.onTeal} />}
            onPress={() => router.push('/analytics' as any)}
          />
        </Card>
      ) : (
        /* ================= BRAND DETAILS CARD ================= */
        <Card elevated style={{ marginBottom: 20 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
              gap: 8,
            }}
          >
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                color: PeacockColors.text,
                fontSize: 16,
                fontWeight: '700',
                flex: 1,
                minWidth: 0,
              }}
            >
              Brand Profile Details
            </Text>

            <Button
              title="Edit"
              variant="outline"
              size="sm"
              icon={<Edit3 size={13} color={PeacockColors.text} />}
              onPress={() => router.push('/profile-edit' as any)}
            />
          </View>

          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={{ color: PeacockColors.muted, fontSize: 14 }}>Industry</Text>
              <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '600' }}>
                {brandData?.industry || 'Not set'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={{ color: PeacockColors.muted, fontSize: 14 }}>Campaign Goal</Text>
              <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '600' }}>
                {brandData?.campaign_goal || 'Not set'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={{ color: PeacockColors.muted, fontSize: 14 }}>Budget Range</Text>
              <Text style={{ color: PeacockColors.gold, fontSize: 14, fontWeight: '700' }}>
                {brandData?.budget_range || 'Not set'}
              </Text>
            </View>

            {brandData?.website ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ color: PeacockColors.muted, fontSize: 14 }}>Website</Text>
                <Text style={{ color: PeacockColors.blue, fontSize: 14, fontWeight: '500' }}>
                  {brandData.website}
                </Text>
              </View>
            ) : null}
          </View>
        </Card>
      )}

      {/* Account Details Card */}
      <Card elevated style={{ marginBottom: 20 }}>
        <Text style={{ color: PeacockColors.text, fontSize: 17, fontWeight: '700', marginBottom: 12 }}>
          Account Settings
        </Text>

        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Mail size={16} color={PeacockColors.muted} />
              <Text style={{ color: PeacockColors.muted, fontSize: 14 }}>Email</Text>
            </View>
            <Text style={{ color: PeacockColors.text, fontSize: 14, fontWeight: '500' }}>
              {user.email}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={16} color={PeacockColors.ok} />
              <Text style={{ color: PeacockColors.muted, fontSize: 14 }}>Design Theme</Text>
            </View>
            <Text style={{ color: PeacockColors.teal, fontSize: 14, fontWeight: '600' }}>
              Royal Peacock (Dark)
            </Text>
          </View>
        </View>
      </Card>

      {/* Actions */}
      <View style={{ gap: 12, marginTop: 4 }}>
        <Button
          title="Edit Profile Information"
          variant="secondary"
          icon={<Edit3 size={16} color={PeacockColors.text} />}
          onPress={() => router.push('/profile-edit' as any)}
        />

        <Button
          title="Log Out"
          variant="danger"
          icon={<LogOut size={16} color={PeacockColors.text} />}
          onPress={handleLogout}
        />
      </View>
    </ScrollView>
  );
}
