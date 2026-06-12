import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors, radii } from '../theme';

interface ProgressBarProps {
  current: number; // 0-based index
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps): React.ReactElement {
  const progress = total > 0 ? current / total : 0;
  const animValue = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [animValue, progress]);

  const widthInterpolated = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { width: widthInterpolated }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.brandMid,
    borderRadius: radii.full,
  },
});
