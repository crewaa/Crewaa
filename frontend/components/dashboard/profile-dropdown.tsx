"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Settings, User } from "lucide-react";
import { logout } from "../../lib/auth";
import { api } from "../../lib/axios";
import { getSafeImageUrl } from "../../lib/images";

interface Props {
  user: {
    /**
     * Optional: `GET /users/me` returns only {id, email, role}, so this is
     * usually absent. It used to be typed as required, and the component
     * rendered a blank line for every user because the value was undefined.
     */
    id?: number;
    name?: string;
    email: string;
    role?: string;
    avatarUrl?: string;
  };
}

export default function ProfileDropdown({ user }: Props) {
  const router = useRouter();
  const [avatar, setAvatar] = useState<string | undefined>(user.avatarUrl);

  // If no avatar is passed, fetch from creator or brand profile
  useEffect(() => {
    if (avatar || !user?.id) return;
    let cancelled = false;

    if (user.role === "INFLUENCER") {
      api
        .get(`/instagram/analytics/${user.id}`)
        .then((res) => {
          if (!cancelled && res.data?.profile?.profile_picture) {
            setAvatar(res.data.profile.profile_picture);
          } else {
            api
              .get(`/youtube/analytics/${user.id}`)
              .then((ytRes) => {
                if (!cancelled && ytRes.data?.channel?.profile_picture) {
                  setAvatar(ytRes.data.channel.profile_picture);
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    } else if (user.role === "BRAND") {
      api
        .get("/users/brand-profile")
        .then((res) => {
          if (!cancelled && res.data?.logo_url) {
            setAvatar(res.data.logo_url);
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [user, avatar]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.replace("/login");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Avatar className="h-9 w-9 cursor-pointer border border-white/20 hover:border-peacock-teal transition">
          <AvatarImage src={getSafeImageUrl(avatar)} referrerPolicy="no-referrer" />
          <AvatarFallback className="bg-peacock-surface text-peacock-teal font-semibold">
            {(user.name || user.email)?.charAt(0)?.toUpperCase() ?? "U"}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 bg-peacock-surface border-white/10 text-white">
        <DropdownMenuLabel>
          <p className="text-sm font-medium text-white">{user.name || user.email}</p>
          {user.name && (
            <p className="text-xs text-gray-400">{user.email}</p>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-white/10" />

        <DropdownMenuItem
          className="hover:bg-white/10 cursor-pointer focus:bg-white/10 focus:text-white"
          onClick={() =>
            router.push(
              user.role === "ADMIN"
                ? "/dashboard/admin"
                : user.role === "BRAND"
                ? "/dashboard/brand-profile"
                : "/dashboard/profile"
            )
          }
        >
          <User className="mr-2 h-4 w-4 text-peacock-teal" />
          {user.role === "ADMIN" ? "Admin Console" : "Profile"}
        </DropdownMenuItem>

        <DropdownMenuItem
          className="hover:bg-white/10 cursor-pointer focus:bg-white/10 focus:text-white"
          onClick={() => router.push("/dashboard/settings")}
        >
          <Settings className="mr-2 h-4 w-4 text-peacock-teal" />
          Email settings
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-white/10" />

        <DropdownMenuItem
          onClick={handleLogout}
          className="text-red-400 hover:bg-red-500/10 hover:text-red-300 focus:bg-red-500/10 focus:text-red-300 cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
