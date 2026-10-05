// Global application configuration
export const config = {
  // App metadata
  appName: 'AA2000 Site Survey',
  version: '1.0.0',
  environment: import.meta.env.MODE || 'development',

  // API configuration
  apiBase: import.meta.env.VITE_API_BASE_URL || '',
  apiKey: import.meta.env.VITE_API_KEY || '',

  // Supabase configuration
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  },

  // Mistral AI configuration
  mistral: {
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
  },

  // Geo configuration
  geo: {
    apiKey: import.meta.env.VITE_GEO_API_KEY || '',
  },

  // Feature flags
  features: {
    voiceInput: true,
    offlineMode: true,
    supabasFallback: true,
    advancedScheduling: true,
    aiReporting: true,
  },

  // UI configuration
  ui: {
    theme: 'light',
    compactMode: false,
    sidebarCollapsed: false,
  },

  // Data retention (in days)
  dataRetention: {
    projects: 365,
    surveys: 180,
    reports: 90,
  },

  // File upload limits
  uploads: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf', 'image/webp'],
    surveyImageCount: 50,
    floorPlanDimensions: { maxWidth: 4000, maxHeight: 4000 },
  },

  // Pricing and estimation
  pricing: {
    currency: 'USD',
    taxRate: 0.08,
    laborRate: 85, // hourly rate
    weekendMultiplier: 1.5,
    holidayMultiplier: 2.0,
  },

  // Validation rules
  validation: {
    email: {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    phone: {
      pattern: /^\+?1?-?\.?\s?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/,
    },
    name: {
      minLength: 2,
      maxLength: 100,
    },
  },
};
