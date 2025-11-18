import { Platform, type ColorSchemeName } from 'react-native';

export type Palette = {
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  textPrimary: string;
  textSecondary: string;
  textOnSurface: string;
  headerBackground: string;
  headerText: string;
  accent: string;
  border: string;
  buttonText: string;
  tabBarBackground: string;
  inputBackground: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
};

export const defaultPalette: Record<Exclude<ColorSchemeName, null | undefined>, Palette> = {
  light: {
    background: '#2CA6A4',
    surface: '#FFFFFF',
    primary: '#6E1F7C',
    secondary: '#8F35A9',
    textPrimary: '#FFFFFF',
    textSecondary: '#E7F8F6',
    textOnSurface: '#2C1E3E',
    headerBackground: '#6E1F7C',
    headerText: '#FFFFFF',
    accent: '#F9C46B',
    border: '#FFFFFF66',
    buttonText: '#FFFFFF',
    tabBarBackground: '#6E1F7C',
    inputBackground: '#FFFFFF',
    inputBorder: '#FFFFFF66',
    inputText: '#2D2D2D',
    inputPlaceholder: '#6D6D6D',
  },
  dark: {
    background: '#112628',
    surface: '#1F3537',
    primary: '#C186F7',
    secondary: '#A86AE6',
    textPrimary: '#F5F5F5',
    textSecondary: '#C7D9D9',
    textOnSurface: '#F5F5F5',
    headerBackground: '#3B1E4F',
    headerText: '#F5F5F5',
    accent: '#FFDD8F',
    border: '#3F4F50',
    buttonText: '#1A1A1A',
    tabBarBackground: '#3B1E4F',
    inputBackground: '#2A4041',
    inputBorder: '#4B5E5F',
    inputText: '#F5F5F5',
    inputPlaceholder: '#A1B2B3',
  },
};

export const Colors = {
  light: {
    text: defaultPalette.light.textPrimary,
    background: defaultPalette.light.background,
    tint: defaultPalette.light.primary,
    icon: defaultPalette.light.textSecondary,
    tabIconDefault: defaultPalette.light.textSecondary,
    tabIconSelected: defaultPalette.light.primary,
  },
  dark: {
    text: defaultPalette.dark.textPrimary,
    background: defaultPalette.dark.background,
    tint: defaultPalette.dark.primary,
    icon: defaultPalette.dark.textSecondary,
    tabIconDefault: defaultPalette.dark.textSecondary,
    tabIconSelected: defaultPalette.dark.primary,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
