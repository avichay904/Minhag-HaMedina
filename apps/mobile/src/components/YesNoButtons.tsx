import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography, shadow } from '../theme';

interface YesNoButtonsProps {
  labelYes: string;
  labelNo: string;
  onYes: () => void;
  onNo: () => void;
  disabled?: boolean;
}

export function YesNoButtons({
  labelYes,
  labelNo,
  onYes,
  onNo,
  disabled = false,
}: YesNoButtonsProps): React.ReactElement {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.btn, styles.yesBtn]}
        onPress={onYes}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Text style={styles.yesText}>{labelYes}</Text>
      </TouchableOpacity>

      <View style={styles.gap} />

      <TouchableOpacity
        style={[styles.btn, styles.noBtn]}
        onPress={onNo}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Text style={styles.noText}>{labelNo}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
  },
  gap: {
    width: spacing.md,
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.xl,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  yesBtn: {
    backgroundColor: colors.yes,
  },
  noBtn: {
    backgroundColor: colors.no,
  },
  yesText: {
    color: '#fff',
    fontSize: typography.sizeXxl,
    fontWeight: typography.weightBold,
    textAlign: 'center',
  },
  noText: {
    color: '#fff',
    fontSize: typography.sizeXxl,
    fontWeight: typography.weightBold,
    textAlign: 'center',
  },
});
