import '../global.css';

import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../lib/auth-context';
import { PeacockColors } from '../constants/Colors';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
    },
  },
});

const CrewaaDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: PeacockColors.bg,
    card: PeacockColors.deep,
    text: PeacockColors.text,
    border: PeacockColors.line,
    primary: PeacockColors.teal,
    notification: PeacockColors.gold,
  },
};

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={CrewaaDarkTheme}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: PeacockColors.deep,
              },
              headerTintColor: PeacockColors.text,
              headerTitleStyle: {
                fontWeight: '600',
              },
              contentStyle: {
                backgroundColor: PeacockColors.bg,
              },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen
              name="profile-edit"
              options={{
                headerTitle: 'Edit Profile',
                headerBackTitle: 'Back',
              }}
            />
            <Stack.Screen
              name="analytics"
              options={{
                headerTitle: 'Analytics & Authenticity',
                headerBackTitle: 'Back',
              }}
            />
            <Stack.Screen
              name="discover"
              options={{
                headerTitle: 'Discover Creators',
                headerBackTitle: 'Back',
              }}
            />
            <Stack.Screen
              name="interested-creators"
              options={{
                headerTitle: 'Interested Creators',
                headerBackTitle: 'Back',
              }}
            />
            <Stack.Screen
              name="campaigns"
              options={{
                headerTitle: 'Campaigns',
                headerBackTitle: 'Back',
              }}
            />
            <Stack.Screen
              name="analyze-profile"
              options={{
                headerTitle: 'AI Growth Analyzer',
                headerBackTitle: 'Back',
              }}
            />
            <Stack.Screen
              name="notifications"
              options={{
                headerTitle: 'Notifications',
                headerBackTitle: 'Back',
              }}
            />
            <Stack.Screen
              name="modal"
              options={{
                presentation: 'modal',
                headerTitle: 'Details',
              }}
            />
          </Stack>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
