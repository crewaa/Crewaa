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

  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return {
          paddingVertical: 7,
          paddingHorizontal: 12,
          borderRadius: 8,
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
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderRadius: 12,
        };
    }
  };

  const getTextColor = (): string => {
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

  const getTextSizeStyle = (): TextStyle => {
    switch (size) {
      case 'sm':
        return {
          fontSize: 13,
          fontWeight: '700',
        };
      case 'lg':
        return {
          fontSize: 16,
          fontWeight: '700',
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
      const effectiveColor = customColor ?? textColor;
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
        state.pressed ? { opacity: 0.85 } : null,
        disabled ? { opacity: 0.5 } : null,
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
    borderWidth: 1,
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
  },
});
