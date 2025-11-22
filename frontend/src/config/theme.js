/**
 * Theme Configuration for White-Label Customization
 *
 * This file allows complete customization of the UI appearance.
 * Override these values to match your brand identity.
 *
 * Usage:
 * 1. Copy this file to theme.local.js
 * 2. Modify the values to match your brand
 * 3. The app will use your custom theme
 */

const defaultTheme = {
  // ===========================================
  // BRAND IDENTITY
  // ===========================================
  brand: {
    name: 'OpenIntraHub',
    tagline: 'Enterprise Social Intranet',
    logo: '/logo/transparent.png',
    logoLight: '/logo/light.png',  // For dark backgrounds
    logoDark: '/logo/dark.png',    // For light backgrounds
    favicon: '/favicon.ico',

    // Remove or customize "Powered by" text
    // Set to null to remove completely
    poweredBy: null,
  },

  // ===========================================
  // COLOR PALETTE
  // ===========================================
  colors: {
    // Primary brand color (main accent)
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',  // Main primary color
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
    },

    // Secondary accent color
    secondary: {
      500: '#8b5cf6',
      600: '#7c3aed',
    },

    // Neutral/Gray colors
    neutral: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },

    // Semantic colors
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',

    // Background colors
    background: '#f9fafb',
    surface: '#ffffff',

    // Dark mode overrides
    dark: {
      background: '#111827',
      surface: '#1f2937',
      text: '#f9fafb',
    },
  },

  // ===========================================
  // TYPOGRAPHY
  // ===========================================
  typography: {
    // Font families
    fontFamily: {
      sans: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      mono: "'Fira Code', 'Consolas', monospace",
    },

    // Font sizes (rem)
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },

    // Font weights
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },

  // ===========================================
  // LAYOUT
  // ===========================================
  layout: {
    // Sidebar configuration
    sidebar: {
      width: '256px',
      collapsedWidth: '64px',
      background: '#ffffff',
      borderColor: '#e5e7eb',
    },

    // Header configuration
    header: {
      height: '64px',
      background: '#ffffff',
      borderColor: '#e5e7eb',
    },

    // Content area
    content: {
      maxWidth: '1280px',
      padding: '1.5rem',
    },

    // Border radius
    borderRadius: {
      sm: '0.25rem',
      md: '0.5rem',
      lg: '0.75rem',
      xl: '1rem',
      full: '9999px',
    },
  },

  // ===========================================
  // SHADOWS
  // ===========================================
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  },

  // ===========================================
  // COMPONENTS
  // ===========================================
  components: {
    // Button styles
    button: {
      borderRadius: '0.5rem',
      paddingX: '1rem',
      paddingY: '0.5rem',
      fontWeight: 500,
    },

    // Card styles
    card: {
      borderRadius: '0.75rem',
      padding: '1rem',
      shadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
    },

    // Input styles
    input: {
      borderRadius: '0.5rem',
      borderWidth: '1px',
      focusRingWidth: '2px',
    },

    // Avatar styles
    avatar: {
      borderRadius: '9999px',
      sizes: {
        sm: '2rem',
        md: '2.5rem',
        lg: '3rem',
        xl: '4rem',
      },
    },
  },

  // ===========================================
  // NAVIGATION
  // ===========================================
  navigation: {
    // Main navigation items
    // Add, remove, or reorder items
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'home', path: '/' },
      { key: 'feed', label: 'Feed', icon: 'activity', path: '/feed' },
      { key: 'posts', label: 'Posts', icon: 'file-text', path: '/posts' },
      { key: 'events', label: 'Events', icon: 'calendar', path: '/events' },
      { key: 'chat', label: 'Chat', icon: 'message-circle', path: '/chat' },
      { key: 'mail', label: 'Mail', icon: 'mail', path: '/mail' },
      { key: 'drive', label: 'Drive', icon: 'folder', path: '/drive' },
      { key: 'projects', label: 'Projekte', icon: 'briefcase', path: '/projects' },
      { key: 'locations', label: 'Standorte', icon: 'map-pin', path: '/locations' },
    ],

    // Admin navigation items
    adminItems: [
      { key: 'users', label: 'Benutzer', icon: 'users', path: '/admin/users' },
      { key: 'ldap', label: 'LDAP', icon: 'server', path: '/admin/ldap' },
      { key: 'modules', label: 'Module', icon: 'package', path: '/admin/modules' },
      { key: 'pages', label: 'Seiten', icon: 'layout', path: '/admin/pages' },
      { key: 'theme', label: 'Design', icon: 'palette', path: '/admin/theme' },
    ],
  },

  // ===========================================
  // FEATURES
  // ===========================================
  features: {
    // Enable/disable features
    darkMode: true,
    notifications: true,
    search: true,
    userStatus: true,

    // Module visibility
    modules: {
      posts: true,
      events: true,
      chat: true,
      mail: true,
      drive: true,
      projects: true,
      locations: true,
      pageBuilder: true,
    },
  },

  // ===========================================
  // LOCALIZATION
  // ===========================================
  localization: {
    defaultLanguage: 'de',
    availableLanguages: ['de', 'en', 'fr', 'es', 'it', 'pl', 'nl'],
    dateFormat: 'DD.MM.YYYY',
    timeFormat: 'HH:mm',
  },
};

/**
 * Apply theme to CSS variables
 */
export function applyTheme(theme = defaultTheme) {
  const root = document.documentElement;

  // Apply color variables
  Object.entries(theme.colors.primary).forEach(([key, value]) => {
    root.style.setProperty(`--color-primary-${key}`, value);
  });

  // Apply other variables
  root.style.setProperty('--sidebar-width', theme.layout.sidebar.width);
  root.style.setProperty('--header-height', theme.layout.header.height);
  root.style.setProperty('--border-radius', theme.layout.borderRadius.md);
  root.style.setProperty('--border-radius-lg', theme.layout.borderRadius.lg);
  root.style.setProperty('--font-family', theme.typography.fontFamily.sans);
}

/**
 * Get merged theme with user overrides
 */
export function getTheme(overrides = {}) {
  return deepMerge(defaultTheme, overrides);
}

/**
 * Deep merge utility
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

export default defaultTheme;
