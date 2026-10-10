import { Stack } from 'expo-router';
import React from 'react';
import { PeacockColors } from '../../constants/Colors';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: PeacockColors.bg,
        },
        headerTintColor: PeacockColors.text,
        headerShown: false,
        contentStyle: {
          backgroundColor: PeacockColors.bg,
        },
      }}
    />
  );
}
