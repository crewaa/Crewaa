import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { PeacockColors } from '../../constants/Colors';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends PressableProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  className?: string;
  icon?: React.ReactNode;
  textStyle?: StyleProp<TextStyle>;
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  onPress,
  className = '',
  style,
  textStyle,
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

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: '#16A597',
          borderColor: '#4EEAD8',
          borderWidth: 1.2,
          shadowColor: '#16A597',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.38,
          shadowRadius: 10,
          elevation: 5,
        };
      case 'secondary':
        return {
          backgroundColor: 'rgba(38, 189, 176, 0.12)',
          borderColor: 'rgba(38, 189, 176, 0.35)',
          borderWidth: 1,
        };
      case 'outline':
        return {
          backgroundColor: 'rgba(38, 189, 176, 0.08)',
          borderColor: 'rgba(38, 189, 176, 0.35)',
          borderWidth: 1,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          borderWidth: 1,
        };
      case 'danger':
        return {
          backgroundColor: 'rgba(242, 113, 107, 0.12)',
          borderColor: 'rgba(242, 113, 107, 0.4)',
          borderWidth: 1,
        };
    }
  };

  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return {
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 10,
        };
      case 'lg':
        return {
          paddingVertical: 16,
          paddingHorizontal: 24,
          borderRadius: 14,
        };
      case 'md':
      default:
        return {
          paddingVertical: 13,
          paddingHorizontal: 20,
          borderRadius: 12,
        };
    }
  };

  const getTextColor = (): string => {
    switch (variant) {
      case 'primary':
        return '#FFFFFF';
      case 'secondary':
      case 'outline':
        return PeacockColors.teal;
      case 'danger':
        return PeacockColors.danger;
      case 'ghost':
        return PeacockColors.muted;
    }
  };

  const getTextSizeStyle = (): TextStyle => {
    switch (size) {
      case 'sm':
        return {
          fontSize: 13,
          fontWeight: '700',
        };
      case 'lg':
        return {
          fontSize: 16.5,
          fontWeight: '800',
        };
      case 'md':
      default:
        return {
          fontSize: 15,
          fontWeight: '700',
        };
    }
  };

  const textColor = getTextColor();

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      const iconElement = icon as React.ReactElement<any>;
      const customColor = iconElement.props?.color;
      const effectiveColor =
        !customColor || customColor === PeacockColors.onTeal || customColor === '#03201C'
          ? textColor
          : customColor;
      return (
        <View style={styles.iconContainer}>
          {React.cloneElement(iconElement, { color: effectiveColor })}
        </View>
      );
    }
    return <View style={styles.iconContainer}>{icon}</View>;
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={(state) => [
        styles.base,
        getSizeStyle(),
        getVariantStyle(),
        state.pressed && {
          transform: [{ scale: 0.975 }],
          opacity: variant === 'primary' ? 0.92 : 0.75,
        },
        disabled && { opacity: 0.45 },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={textColor}
        />
      ) : (
        <View style={styles.contentRow}>
          {renderIcon()}
          <Text
            style={[
              styles.text,
              getTextSizeStyle(),
              { color: textColor },
              variant === 'primary' && styles.primaryTextShadow,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  primaryTextShadow: {
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 32, 28, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
