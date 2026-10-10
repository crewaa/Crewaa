import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { PeacockColors } from '../../constants/Colors';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

interface ButtonProps extends PressableProps {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export function Button({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  onPress,
  className = '',
  style,
  icon,
  ...props
}: ButtonProps) {
  const handlePress = (e: any) => {
    if (disabled || loading) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics unavailable on web
    }
    onPress?.(e);
  };

  const getVariantStyle = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: PeacockColors.teal,
          borderColor: 'transparent',
        };
      case 'secondary':
        return {
          backgroundColor: PeacockColors.raised,
          borderColor: PeacockColors.line,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: PeacockColors.line,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
        };
      case 'danger':
        return {
          backgroundColor: PeacockColors.danger,
          borderColor: 'transparent',
        };
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'primary':
        return PeacockColors.onTeal;
      case 'secondary':
      case 'outline':
      case 'danger':
        return PeacockColors.text;
      case 'ghost':
        return PeacockColors.muted;
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={(state) => [
        styles.base,
        getVariantStyle(),
        state.pressed ? { opacity: 0.85 } : null,
        disabled ? { opacity: 0.5 } : null,
        typeof style === 'function' ? style(state) : style,
      ]}
      className={`flex-row items-center justify-center rounded-xl px-5 py-3.5 border ${className}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? PeacockColors.onTeal : PeacockColors.teal}
        />
      ) : (
        <>
          {icon ? <Text className="mr-2">{icon}</Text> : null}
          <Text
            style={[styles.text, { color: getTextColor() }]}
            className="text-base font-bold text-center"
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
