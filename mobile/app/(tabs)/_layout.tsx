import { Tabs } from 'expo-router';
import React from 'react';
import { LayoutGrid, MessageCircle, Sparkles, User } from 'lucide-react-native';
import { PeacockColors } from '../../constants/Colors';
import { useAuth } from '../../lib/auth-context';

export default function TabLayout() {
  const { user } = useAuth();
  const isBrand = user?.role === 'BRAND';

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: PeacockColors.deep,
          borderBottomWidth: 1,
          borderBottomColor: PeacockColors.line,
        },
        headerTintColor: PeacockColors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        tabBarStyle: {
          backgroundColor: PeacockColors.deep,
          borderTopWidth: 1,
          borderTopColor: PeacockColors.line,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: PeacockColors.teal,
        tabBarInactiveTintColor: PeacockColors.muted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Studio',
          tabBarLabel: 'Studio',
          tabBarIcon: ({ color, size }) => (
            <LayoutGrid size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="deals"
        options={{
          title: isBrand ? 'Campaigns' : 'Brand Deals',
          tabBarLabel: isBrand ? 'Campaigns' : 'Deals',
          tabBarIcon: ({ color, size }) => (
            <Sparkles size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color, size }) => (
            <MessageCircle size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <User size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          href: null, // Hide old default template tab
        }}
      />
    </Tabs>
  );
}
