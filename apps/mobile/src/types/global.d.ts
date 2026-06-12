// Expo injects EXPO_PUBLIC_* variables onto process.env at build time (Babel).
// React Native ships no Node types, so declare the minimal shape we use.
declare const process: {
  env: Record<string, string | undefined>;
};
