import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PeacockColors } from '../../constants/Colors';

export type BadgeVariant = 'teal' | 'gold' | 'blue' | 'ok' | 'warn' | 'danger' | 'muted';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ label, variant = 'teal', className = '' }: BadgeProps) {
  const getColors = () => {
    switch (variant) {
      case 'teal':
        return {
          bg: 'rgba(38, 189, 176, 0.15)',
          border: 'rgba(38, 189, 176, 0.35)',
          text: PeacockColors.teal,
        };
      case 'gold':
        return {
          bg: 'rgba(216, 180, 90, 0.15)',
          border: 'rgba(216, 180, 90, 0.35)',
          text: PeacockColors.gold,
        };
      case 'blue':
        return {
          bg: 'rgba(79, 179, 217, 0.15)',
          border: 'rgba(79, 179, 217, 0.35)',
          text: PeacockColors.blue,
        };
      case 'ok':
        return {
          bg: 'rgba(134, 211, 107, 0.15)',
          border: 'rgba(134, 211, 107, 0.35)',
          text: PeacockColors.ok,
        };
      case 'warn':
        return {
          bg: 'rgba(242, 154, 74, 0.15)',
          border: 'rgba(242, 154, 74, 0.35)',
          text: PeacockColors.warn,
        };
      case 'danger':
        return {
          bg: 'rgba(242, 113, 107, 0.15)',
          border: 'rgba(242, 113, 107, 0.35)',
          text: PeacockColors.danger,
        };
      case 'muted':
      default:
        return {
          bg: PeacockColors.raised,
          border: PeacockColors.line,
          text: PeacockColors.muted,
        };
    }
  };

  const colors = getColors();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
      ]}
      className={`self-start rounded-full px-3 py-1 border ${className}`}
    >
      <Text
        style={[styles.text, { color: colors.text }]}
        className="text-xs font-semibold"
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
