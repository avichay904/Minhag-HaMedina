import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';

interface ScaleDotsProps {
  min: number;
  max: number;
  onSelect: (value: number) => void;
  disabled?: boolean;
}

export function ScaleDots({
  min,
  max,
  onSelect,
  disabled = false,
}: ScaleDotsProps): React.ReactElement {
  const [selected, setSelected] = useState<number | null>(null);

  const values: number[] = [];
  for (let i = min; i <= max; i++) values.push(i);

  const handlePress = (v: number) => {
    if (disabled) return;
    setSelected(v);
    onSelect(v);
  };

  return (
    <View style={styles.container}>
      {values.map((v) => {
        const isSelected = selected === v;
        return (
          <TouchableOpacity
            key={v}
            style={[styles.dot, isSelected ? styles.dotSelected : styles.dotDefault]}
            onPress={() => handlePress(v)}
            disabled={disabled}
            activeOpacity={0.75}
          >
            <Text style={[styles.label, isSelected ? styles.labelSelected : styles.labelDefault]}>
              {v}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  dot: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  dotDefault: {
    backgroundColor: colors.surface,
    borderColor: colors.brandMid,
  },
  dotSelected: {
    backgroundColor: colors.brandMid,
    borderColor: colors.brandMid,
  },
  label: {
    fontSize: typography.sizeLg,
    fontWeight: typography.weightSemibold,
  },
  labelDefault: {
    color: colors.brandMid,
  },
  labelSelected: {
    color: colors.textOnBrand,
  },
});
