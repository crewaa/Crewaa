"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/lib/session";
import {
  ExternalLink,
  Instagram,
  MapPin,
  Sparkles,
  User,
  Youtube,
} from "lucide-react";
import VerificationCard from "@/components/dashboard/verification-card";
import { getSafeImageUrl } from "@/lib/images";

type CreatorProfile = {
  id?: number;
  full_name: string;
  location: string;
  primary_platform: string;
  category: string;
  instagram_username?: string;
  instagram_profile_link?: string;
  youtube_username?: string;
  youtube_profile_link?: string;
  bio?: string;
};

export default function CreatorProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useSession();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const previousInstagramRef = useRef<string | null>(null);
  const previousYoutubeRef = useRef<string | null>(null);

  // Fetch profile if exists (EDIT MODE) and avatar from scraped stats
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await api.get("/users/creator-profile");
        setProfile(res.data);
        previousInstagramRef.current = res.data?.instagram_username ?? null;
        previousYoutubeRef.current = res.data?.youtube_username ?? null;
      } catch {
        // Profile doesn't exist → CREATE MODE
        setProfile({
          full_name: "",
          location: "",
          primary_platform: "Instagram",
          category: "",
          instagram_username: "",
          instagram_profile_link: "",
          youtube_username: "",
          youtube_profile_link: "",
          bio: "",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  // Fetch avatar from Instagram or YouTube analytics once user is known
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    async function loadAvatar() {
      // 1. Try Instagram profile picture first
      try {
        const igRes = await api.get(`/instagram/analytics/${user!.id}`);
        if (!cancelled && igRes.data?.profile?.profile_picture) {
          setAvatarUrl(igRes.data.profile.profile_picture);
          return;
        }
      } catch {
        // Continue to YouTube
      }

      // 2. Try YouTube profile picture
      try {
        const ytRes = await api.get(`/youtube/analytics/${user!.id}`);
        if (!cancelled && ytRes.data?.channel?.profile_picture) {
          setAvatarUrl(ytRes.data.channel.profile_picture);
          return;
        }
      } catch {
        // Neither available
      }
    }

    loadAvatar();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = e.currentTarget;

    const payload = {
      full_name: form.full_name.value,
      location: form.location.value,
      primary_platform: form.primary_platform.value,
      category: form.category.value,
      instagram_username: form.instagram_username.value || null,
      instagram_profile_link: form.instagram_profile_link.value || null,
      youtube_username: form.youtube_username.value || null,
      youtube_profile_link: form.youtube_profile_link.value || null,
      bio: form.bio.value || null,
    };

    try {
      let savedProfile: CreatorProfile;

      if (profile?.id) {
        // EDIT
        const res = await api.put("/users/creator-profile", payload);
        savedProfile = res.data;
      } else {
        // CREATE
        const res = await api.post("/users/creator-profile", payload);
        savedProfile = res.data;
      }

      setProfile(savedProfile);
      previousInstagramRef.current = savedProfile.instagram_username ?? "";
      previousYoutubeRef.current = savedProfile.youtube_username ?? "";

      toast.success("Profile saved. We're fetching your analytics now.");
      router.replace("/dashboard/analytics/influencer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !profile) return null;

  const hasAvatar = Boolean(avatarUrl && avatarUrl.trim()) && !avatarError;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-start gap-6 px-4 py-12 sm:px-6">
      {/* User Header Profile Card */}
      <div className="w-full rounded-2xl border border-white/10 bg-gradient-to-br from-peacock-surface to-peacock-deep p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          {/* Avatar Ring */}
          <div className="relative shrink-0">
            {hasAvatar ? (
              <img
                src={getSafeImageUrl(avatarUrl!)}
                alt={profile.full_name || "Profile picture"}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover border-2 border-peacock-teal bg-peacock-surface shadow-md"
              />
            ) : (
              <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full border-2 border-peacock-teal bg-peacock-surface text-peacock-teal shadow-md">
                <User className="h-10 w-10 sm:h-12 sm:w-12" />
              </div>
            )}
          </div>

          {/* User Details */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">
                {profile.full_name || "Creator Profile"}
              </h1>
              <span className="rounded-full bg-peacock-teal/15 border border-peacock-teal/30 px-2.5 py-0.5 text-xs font-semibold text-peacock-teal">
                Creator
              </span>
            </div>

            {user?.email && (
              <p className="mt-1 text-sm text-gray-400">{user.email}</p>
            )}

            <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-400">
              {profile.category && (
                <span>{profile.category} · {profile.primary_platform || "Instagram"}</span>
              )}
              {profile.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-peacock-teal" /> {profile.location}
                </span>
              )}
            </div>

            {profile.bio && (
              <p className="mt-3 text-sm text-gray-300 leading-relaxed line-clamp-2">
                {profile.bio}
              </p>
            )}
          </div>
        </div>

        {/* Social Handles Status Bar (direct clickable links) */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-6 border-t border-white/10">
          {/* Instagram Handle Status */}
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <Instagram className="h-5 w-5 text-pink-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">Instagram</p>
                <p className="text-xs text-gray-400 truncate">
                  {profile.instagram_username
                    ? `@${profile.instagram_username.replace(/^@/, "")}`
                    : "Not linked"}
                </p>
              </div>
            </div>

            {profile.instagram_username ? (
              <a
                href={
                  profile.instagram_profile_link ||
                  `https://instagram.com/${profile.instagram_username.replace(/^@/, "")}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-pink-500/15 border border-pink-500/30 px-2.5 py-1 text-xs font-medium text-pink-300 hover:bg-pink-500/25 transition"
              >
                <span>Linked ✓</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-gray-500 font-medium">
                Not connected
              </span>
            )}
          </div>

          {/* YouTube Handle Status */}
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <Youtube className="h-5 w-5 text-red-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">YouTube</p>
                <p className="text-xs text-gray-400 truncate">
                  {profile.youtube_username || profile.youtube_profile_link || "Not linked"}
                </p>
              </div>
            </div>

            {profile.youtube_username || profile.youtube_profile_link ? (
              <a
                href={
                  profile.youtube_profile_link ||
                  `https://youtube.com/@${(profile.youtube_username || "").replace(/^@/, "")}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-red-500/15 border border-red-500/30 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-500/25 transition"
              >
                <span>Linked ✓</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-gray-500 font-medium">
                Not connected
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="w-full">
        <VerificationCard />
      </div>

      {/* Edit Creator Profile Form */}
      <Card className="w-full p-6 sm:p-8 space-y-6 rounded-2xl border-white/10 bg-peacock-surface">
        <div>
          <h2 className="text-2xl font-display font-medium text-white">
            {profile.id ? "Edit Creator Profile" : "Complete Creator Profile"}
          </h2>
          <p className="text-sm text-gray-400 mt-2">
            Update your profile and social handles to pull the latest stats and unlock AI features.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Basic Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Full Name *</label>
                <Input
                  name="full_name"
                  defaultValue={profile.full_name}
                  placeholder="Your full name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Location</label>
                <Input
                  name="location"
                  defaultValue={profile.location}
                  placeholder="City, Country"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Category *</label>
                <Input
                  name="category"
                  defaultValue={profile.category}
                  placeholder="e.g., Fashion, Tech, Gaming"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Primary Platform *
                </label>
                <select
                  name="primary_platform"
                  defaultValue={profile.primary_platform}
                  className="w-full rounded-md border border-white/10 bg-peacock-deep p-2 text-white"
                  required
                >
                  <option value="Instagram">Instagram</option>
                  <option value="YouTube">YouTube</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Bio</label>
              <Textarea
                name="bio"
                defaultValue={profile.bio}
                placeholder="Tell us about yourself"
                rows={3}
              />
            </div>
          </div>

          {/* Instagram Section */}
          <div className="space-y-4 p-5 border border-pink-500/20 rounded-xl bg-pink-500/5">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-pink-400">
              <Instagram className="h-5 w-5" /> Instagram
            </h3>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Instagram Username
              </label>
              <Input
                name="instagram_username"
                defaultValue={profile.instagram_username}
                placeholder="username (without @)"
              />
              <p className="text-xs text-gray-400 mt-1">
                Enter your Instagram handle
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Instagram Profile Link
              </label>
              <Input
                name="instagram_profile_link"
                defaultValue={profile.instagram_profile_link}
                placeholder="https://instagram.com/username"
              />
            </div>
          </div>

          {/* YouTube Section */}
          <div className="space-y-4 p-5 border border-red-500/20 rounded-xl bg-red-500/5">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-red-400">
              <Youtube className="h-5 w-5" /> YouTube
            </h3>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                YouTube Channel Name
              </label>
              <Input
                name="youtube_username"
                defaultValue={profile.youtube_username}
                placeholder="Your channel name"
              />
              <p className="text-xs text-gray-400 mt-1">
                Enter your YouTube channel name or handle
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                YouTube Channel Link
              </label>
              <Input
                name="youtube_profile_link"
                defaultValue={profile.youtube_profile_link}
                placeholder="https://youtube.com/@channelname"
              />
            </div>
          </div>

          <Button disabled={saving} className="w-full bg-peacock-teal text-peacock-on-teal font-semibold hover:brightness-110" size="lg">
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
