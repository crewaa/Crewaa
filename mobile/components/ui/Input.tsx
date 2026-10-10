import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { PeacockColors } from '../../constants/Colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
}

export function Input({ label, error, className = '', style, onFocus, onBlur, ...props }: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className="mb-4 w-full">
      {label ? (
        <Text
          style={{ color: PeacockColors.text }}
          className="text-sm font-semibold mb-2"
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={PeacockColors.muted}
        selectionColor={PeacockColors.teal}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            borderColor: error
              ? PeacockColors.danger
              : isFocused
              ? PeacockColors.teal
              : PeacockColors.line,
          },
          style,
        ]}
        className={`w-full rounded-xl px-4 py-3.5 text-base ${className}`}
        {...props}
      />
      {error ? (
        <Text
          style={{ color: PeacockColors.danger }}
          className="mt-1.5 text-xs"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: PeacockColors.surface,
    color: PeacockColors.text,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 16,
  },
});
