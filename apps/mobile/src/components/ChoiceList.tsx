import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography, shadow } from '../theme';
import type { ChoiceOptionDto } from '@mhm/contracts';
import type { Lang } from '../lib/i18n';

interface ChoiceListProps {
  options: ChoiceOptionDto[];
  lang: Lang;
  onSelect: (key: string) => void;
  disabled?: boolean;
}

export function ChoiceList({
  options,
  lang,
  onSelect,
  disabled = false,
}: ChoiceListProps): React.ReactElement {
  const [selected, setSelected] = useState<string | null>(null);

  const handlePress = (key: string) => {
    if (disabled) return;
    setSelected(key);
    onSelect(key);
  };

  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const isSelected = selected === opt.key;
        const label = lang === 'he' ? opt.labelHe : opt.labelEn;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[styles.option, isSelected ? styles.optionSelected : styles.optionDefault]}
            onPress={() => handlePress(opt.key)}
            disabled={disabled}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.label, isSelected ? styles.labelSelected : styles.labelDefault]}
              textBreakStrategy="simple"
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  option: {
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 2,
    ...shadow.sm,
  },
  optionDefault: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  optionSelected: {
    backgroundColor: colors.brandPale,
    borderColor: colors.brandMid,
  },
  label: {
    fontSize: typography.sizeMd,
    fontWeight: typography.weightMedium,
    textAlign: 'right',
  },
  labelDefault: {
    color: colors.textPrimary,
  },
  labelSelected: {
    color: colors.brandDeep,
  },
});
