import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { colors, spacing, typography, radii } from '../theme';
import { loginAnonymous, loginDevGoogle } from '../lib/api';
import { useI18n } from '../lib/i18n';

interface WelcomeScreenProps {
  onLogin: () => void;
}

export function WelcomeScreen({ onLogin }: WelcomeScreenProps): React.ReactElement {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(false);

  const handleAnonymous = async () => {
    setLoading(true);
    try {
      await loginAnonymous();
      onLogin();
    } catch {
      Alert.alert(t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const handleDevGoogle = async () => {
    setDevLoading(true);
    try {
      await loginDevGoogle({ id: 'user_001', name: 'Dev User' });
      onLogin();
    } catch {
      Alert.alert(t('errorGeneric'));
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <Screen scrollable padded={false}>
      {/* Header band */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>מה</Text>
        </View>
        <Text style={styles.title}>{t('welcomeTitle')}</Text>
        <Text style={styles.subtitle}>{t('welcomeSubtitle')}</Text>
      </View>

      {/* Illustration placeholder */}
      <View style={styles.illustrationContainer}>
        <View style={styles.illustration}>
          <Text style={styles.illustrationText}>📊</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <Button
          label={loading ? t('loggingIn') : t('continueAsGuest')}
          onPress={handleAnonymous}
          variant="primary"
          size="lg"
          loading={loading}
          style={styles.btn}
        />
        <Button
          label={devLoading ? t('loggingIn') : t('loginWithGoogle')}
          onPress={handleDevGoogle}
          variant="secondary"
          size="lg"
          loading={devLoading}
          style={styles.btn}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.brandDeep,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    backgroundColor: colors.brandMid,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoText: {
    color: colors.textOnBrand,
    fontSize: typography.sizeXxl,
    fontWeight: typography.weightBold,
  },
  title: {
    color: colors.textOnBrand,
    fontSize: typography.sizeXxl,
    fontWeight: typography.weightBold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.brandPale,
    fontSize: typography.sizeMd,
    textAlign: 'center',
  },
  illustrationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  illustration: {
    width: 140,
    height: 140,
    borderRadius: radii.xl,
    backgroundColor: colors.brandPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationText: {
    fontSize: 64,
  },
  actions: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  btn: {
    width: '100%',
  },
});
