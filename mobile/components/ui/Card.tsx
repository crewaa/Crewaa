import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { PeacockColors } from '../../constants/Colors';

interface CardProps extends ViewProps {
  className?: string;
  elevated?: boolean;
}

export function Card({ children, className = '', elevated = false, style, ...props }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: elevated ? PeacockColors.raised : PeacockColors.surface,
          borderColor: PeacockColors.line,
        },
        elevated ? styles.elevatedShadow : null,
        style,
      ]}
      className={`rounded-2xl p-5 border ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
  },
  elevatedShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
});
