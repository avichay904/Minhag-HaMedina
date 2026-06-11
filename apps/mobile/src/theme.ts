export const colors = {
  // Brand
  brandDeep: '#1e3a5f',
  brandMid: '#2e75b6',
  brandLight: '#4a9fd4',
  brandPale: '#d0e8f8',

  // UI
  background: '#f5f7fa',
  surface: '#ffffff',
  surfaceSecondary: '#eef2f7',
  border: '#dce4ef',

  // Text
  textPrimary: '#1a2740',
  textSecondary: '#5a6a80',
  textDisabled: '#a0b0c0',
  textOnBrand: '#ffffff',

  // Status
  success: '#22c55e',
  successLight: '#dcfce7',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  error: '#ef4444',
  errorLight: '#fee2e2',

  // Answer
  yes: '#22c55e',
  no: '#ef4444',
  yesLight: '#dcfce7',
  noLight: '#fee2e2',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 12,
  lg: 20,
  xl: 28,
  full: 999,
} as const;

export const typography = {
  sizeXs: 11,
  sizeSm: 13,
  sizeMd: 15,
  sizeLg: 18,
  sizeXl: 22,
  sizeXxl: 28,
  sizeDisplay: 34,

  weightRegular: '400' as const,
  weightMedium: '500' as const,
  weightSemibold: '600' as const,
  weightBold: '700' as const,
} as const;

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;
