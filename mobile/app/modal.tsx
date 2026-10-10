import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PeacockColors } from '../constants/Colors';
import { API_BASE_URL } from '../lib/api';

export default function ModalScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-peacock-bg p-6 justify-center">
      <Card elevated className="items-center py-8 px-6 mb-6">
        <View className="h-14 w-14 rounded-2xl bg-peacock-teal/15 items-center justify-center border border-peacock-teal/30 mb-4">
          <Sparkles size={30} color={PeacockColors.teal} />
        </View>
        <Text className="text-2xl font-bold text-peacock-text mb-2 text-center">
          Crewaa Mobile
        </Text>
        <Text className="text-sm text-peacock-muted text-center mb-6 leading-5">
          AI-Powered Influencer Marketing Platform for Brands & Creators.
        </Text>

        <View className="w-full bg-peacock-deep rounded-xl p-3 mb-6 border border-peacock-line/50">
          <Text className="text-xs text-peacock-muted mb-1 font-medium">Backend Endpoint:</Text>
          <Text className="text-xs text-peacock-teal font-mono">{API_BASE_URL}</Text>
        </View>

        <Button
          title="Done"
          variant="primary"
          className="w-full"
          onPress={() => router.back()}
        />
      </Card>
    </View>
  );
}
