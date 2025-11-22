/**
 * Admin Theme Settings Page
 * Visual theme customization for White-Label branding
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const defaultTheme = {
  brand: {
    name: 'OpenIntraHub',
    tagline: 'Enterprise Social Intranet',
    logoUrl: '/logo/transparent.png',
    logoLightUrl: '/logo/light.png',
    logoDarkUrl: '/logo/dark.png',
    faviconUrl: '/favicon.ico',
  },
  colors: {
    primary: '#0284c7',
    primaryLight: '#38bdf8',
    primaryDark: '#0369a1',
    secondary: '#7c3aed',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
  },
  layout: {
    sidebarWidth: '256',
    headerHeight: '64',
    borderRadius: '8',
  },
  features: {
    darkMode: true,
    compactMode: false,
    animations: true,
  }
};

export default function ThemeSettings() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState(defaultTheme);
  const [activeTab, setActiveTab] = useState('brand');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const logoInputRef = useRef(null);
  const faviconInputRef = useRef(null);

  useEffect(() => {
    loadThemeSettings();
  }, []);

  const loadThemeSettings = async () => {
    try {
      const response = await fetch('/api/admin/theme', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.theme) {
          setTheme({ ...defaultTheme, ...data.theme });
        }
      }
    } catch (error) {
      console.error('Failed to load theme settings:', error);
    }
  };

  const saveThemeSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/theme', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ theme })
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        applyThemeToDocument(theme);
      }
    } catch (error) {
      console.error('Failed to save theme settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const applyThemeToDocument = (theme) => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary-500', theme.colors.primary);
    root.style.setProperty('--color-primary-400', theme.colors.primaryLight);
    root.style.setProperty('--color-primary-600', theme.colors.primary);
    root.style.setProperty('--color-primary-700', theme.colors.primaryDark);
    root.style.setProperty('--sidebar-width', `${theme.layout.sidebarWidth}px`);
    root.style.setProperty('--header-height', `${theme.layout.headerHeight}px`);
    root.style.setProperty('--border-radius', `${theme.layout.borderRadius}px`);
  };

  const handleLogoUpload = async (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    try {
      const response = await fetch('/api/admin/theme/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setTheme(prev => ({
          ...prev,
          brand: {
            ...prev.brand,
            [`${type}Url`]: data.url
          }
        }));
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
    }
  };

  const resetToDefaults = () => {
    if (window.confirm('Alle Theme-Einstellungen auf Standard zuruecksetzen?')) {
      setTheme(defaultTheme);
    }
  };

  const tabs = [
    { id: 'brand', label: 'Branding', icon: 'image' },
    { id: 'colors', label: 'Farben', icon: 'palette' },
    { id: 'layout', label: 'Layout', icon: 'layout' },
    { id: 'features', label: 'Features', icon: 'settings' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Theme-Einstellungen</h1>
          <p className="text-gray-500 mt-1">
            Passen Sie das Erscheinungsbild Ihres Intranets an
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="btn btn-secondary"
          >
            {previewMode ? 'Vorschau beenden' : 'Vorschau'}
          </button>
          <button
            onClick={resetToDefaults}
            className="btn btn-ghost"
          >
            Zuruecksetzen
          </button>
          <button
            onClick={saveThemeSettings}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? 'Speichert...' : saved ? 'Gespeichert!' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Panel */}
        <div className="lg:col-span-2">
          {/* Brand Tab */}
          {activeTab === 'brand' && (
            <div className="card space-y-6">
              <h2 className="text-lg font-semibold">Branding</h2>

              {/* App Name */}
              <div>
                <label className="label">Anwendungsname</label>
                <input
                  type="text"
                  className="input"
                  value={theme.brand.name}
                  onChange={(e) => setTheme(prev => ({
                    ...prev,
                    brand: { ...prev.brand, name: e.target.value }
                  }))}
                  placeholder="Ihr Intranet Name"
                />
              </div>

              {/* Tagline */}
              <div>
                <label className="label">Slogan / Tagline</label>
                <input
                  type="text"
                  className="input"
                  value={theme.brand.tagline}
                  onChange={(e) => setTheme(prev => ({
                    ...prev,
                    brand: { ...prev.brand, tagline: e.target.value }
                  }))}
                  placeholder="Ihr Unternehmens-Slogan"
                />
              </div>

              {/* Logo Upload */}
              <div>
                <label className="label">Logo (Hauptlogo)</label>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-16 border rounded-lg flex items-center justify-center bg-gray-50">
                    {theme.brand.logoUrl ? (
                      <img
                        src={theme.brand.logoUrl}
                        alt="Logo"
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <span className="text-gray-400 text-sm">Kein Logo</span>
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={logoInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e, 'logo')}
                    />
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      className="btn btn-secondary btn-sm"
                    >
                      Logo hochladen
                    </button>
                    <p className="text-xs text-gray-500 mt-1">
                      PNG, SVG empfohlen. Max 2MB.
                    </p>
                  </div>
                </div>
              </div>

              {/* Favicon Upload */}
              <div>
                <label className="label">Favicon (Browser-Tab Icon)</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 border rounded-lg flex items-center justify-center bg-gray-50">
                    {theme.brand.faviconUrl ? (
                      <img
                        src={theme.brand.faviconUrl}
                        alt="Favicon"
                        className="w-8 h-8 object-contain"
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">Kein Icon</span>
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={faviconInputRef}
                      className="hidden"
                      accept="image/x-icon,image/png"
                      onChange={(e) => handleLogoUpload(e, 'favicon')}
                    />
                    <button
                      onClick={() => faviconInputRef.current?.click()}
                      className="btn btn-secondary btn-sm"
                    >
                      Favicon hochladen
                    </button>
                    <p className="text-xs text-gray-500 mt-1">
                      ICO oder PNG, 32x32px oder 64x64px
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Colors Tab */}
          {activeTab === 'colors' && (
            <div className="card space-y-6">
              <h2 className="text-lg font-semibold">Farbschema</h2>

              <div className="grid grid-cols-2 gap-4">
                {/* Primary Color */}
                <div>
                  <label className="label">Primaerfarbe</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={theme.colors.primary}
                      onChange={(e) => setTheme(prev => ({
                        ...prev,
                        colors: { ...prev.colors, primary: e.target.value }
                      }))}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.colors.primary}
                      onChange={(e) => setTheme(prev => ({
                        ...prev,
                        colors: { ...prev.colors, primary: e.target.value }
                      }))}
                      className="input flex-1"
                      placeholder="#0284c7"
                    />
                  </div>
                </div>

                {/* Primary Light */}
                <div>
                  <label className="label">Primaer Hell</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={theme.colors.primaryLight}
                      onChange={(e) => setTheme(prev => ({
                        ...prev,
                        colors: { ...prev.colors, primaryLight: e.target.value }
                      }))}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.colors.primaryLight}
                      className="input flex-1"
                      readOnly
                    />
                  </div>
                </div>

                {/* Primary Dark */}
                <div>
                  <label className="label">Primaer Dunkel</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={theme.colors.primaryDark}
                      onChange={(e) => setTheme(prev => ({
                        ...prev,
                        colors: { ...prev.colors, primaryDark: e.target.value }
                      }))}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.colors.primaryDark}
                      className="input flex-1"
                      readOnly
                    />
                  </div>
                </div>

                {/* Secondary */}
                <div>
                  <label className="label">Sekundaerfarbe</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={theme.colors.secondary}
                      onChange={(e) => setTheme(prev => ({
                        ...prev,
                        colors: { ...prev.colors, secondary: e.target.value }
                      }))}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.colors.secondary}
                      className="input flex-1"
                    />
                  </div>
                </div>

                {/* Success */}
                <div>
                  <label className="label">Erfolg (Success)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={theme.colors.success}
                      onChange={(e) => setTheme(prev => ({
                        ...prev,
                        colors: { ...prev.colors, success: e.target.value }
                      }))}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.colors.success}
                      className="input flex-1"
                    />
                  </div>
                </div>

                {/* Warning */}
                <div>
                  <label className="label">Warnung (Warning)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={theme.colors.warning}
                      onChange={(e) => setTheme(prev => ({
                        ...prev,
                        colors: { ...prev.colors, warning: e.target.value }
                      }))}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.colors.warning}
                      className="input flex-1"
                    />
                  </div>
                </div>

                {/* Error */}
                <div>
                  <label className="label">Fehler (Error)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={theme.colors.error}
                      onChange={(e) => setTheme(prev => ({
                        ...prev,
                        colors: { ...prev.colors, error: e.target.value }
                      }))}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.colors.error}
                      className="input flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Color Presets */}
              <div>
                <label className="label">Schnellauswahl (Presets)</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: 'Sky Blue', color: '#0284c7' },
                    { name: 'Emerald', color: '#059669' },
                    { name: 'Violet', color: '#7c3aed' },
                    { name: 'Rose', color: '#e11d48' },
                    { name: 'Orange', color: '#ea580c' },
                    { name: 'Slate', color: '#475569' },
                  ].map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => setTheme(prev => ({
                        ...prev,
                        colors: { ...prev.colors, primary: preset.color }
                      }))}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full border hover:bg-gray-50"
                    >
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: preset.color }}
                      />
                      <span className="text-sm">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Layout Tab */}
          {activeTab === 'layout' && (
            <div className="card space-y-6">
              <h2 className="text-lg font-semibold">Layout-Einstellungen</h2>

              {/* Sidebar Width */}
              <div>
                <label className="label">
                  Sidebar-Breite: {theme.layout.sidebarWidth}px
                </label>
                <input
                  type="range"
                  min="200"
                  max="320"
                  value={theme.layout.sidebarWidth}
                  onChange={(e) => setTheme(prev => ({
                    ...prev,
                    layout: { ...prev.layout, sidebarWidth: e.target.value }
                  }))}
                  className="w-full"
                />
              </div>

              {/* Header Height */}
              <div>
                <label className="label">
                  Header-Hoehe: {theme.layout.headerHeight}px
                </label>
                <input
                  type="range"
                  min="48"
                  max="80"
                  value={theme.layout.headerHeight}
                  onChange={(e) => setTheme(prev => ({
                    ...prev,
                    layout: { ...prev.layout, headerHeight: e.target.value }
                  }))}
                  className="w-full"
                />
              </div>

              {/* Border Radius */}
              <div>
                <label className="label">
                  Ecken-Rundung: {theme.layout.borderRadius}px
                </label>
                <input
                  type="range"
                  min="0"
                  max="16"
                  value={theme.layout.borderRadius}
                  onChange={(e) => setTheme(prev => ({
                    ...prev,
                    layout: { ...prev.layout, borderRadius: e.target.value }
                  }))}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {/* Features Tab */}
          {activeTab === 'features' && (
            <div className="card space-y-6">
              <h2 className="text-lg font-semibold">Feature-Einstellungen</h2>

              {/* Dark Mode Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Dark Mode</div>
                  <div className="text-sm text-gray-500">
                    Erlaube Benutzern den Dark Mode zu aktivieren
                  </div>
                </div>
                <button
                  onClick={() => setTheme(prev => ({
                    ...prev,
                    features: { ...prev.features, darkMode: !prev.features.darkMode }
                  }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    theme.features.darkMode ? 'bg-primary-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      theme.features.darkMode ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Compact Mode */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Kompakt-Modus</div>
                  <div className="text-sm text-gray-500">
                    Reduzierte Abstaende fuer mehr Inhalt
                  </div>
                </div>
                <button
                  onClick={() => setTheme(prev => ({
                    ...prev,
                    features: { ...prev.features, compactMode: !prev.features.compactMode }
                  }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    theme.features.compactMode ? 'bg-primary-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      theme.features.compactMode ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Animations */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Animationen</div>
                  <div className="text-sm text-gray-500">
                    UI-Animationen und Uebergaenge
                  </div>
                </div>
                <button
                  onClick={() => setTheme(prev => ({
                    ...prev,
                    features: { ...prev.features, animations: !prev.features.animations }
                  }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    theme.features.animations ? 'bg-primary-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      theme.features.animations ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-1">
          <div className="card sticky top-6">
            <h3 className="font-semibold mb-4">Live-Vorschau</h3>

            {/* Mini Preview */}
            <div
              className="border rounded-lg overflow-hidden"
              style={{ height: '300px' }}
            >
              {/* Preview Header */}
              <div
                className="flex items-center px-3 border-b"
                style={{
                  height: `${Math.min(theme.layout.headerHeight / 2, 32)}px`,
                  backgroundColor: '#fff'
                }}
              >
                <div className="flex items-center gap-2">
                  {theme.brand.logoUrl && (
                    <img
                      src={theme.brand.logoUrl}
                      alt="Logo"
                      className="h-4 object-contain"
                    />
                  )}
                  <span className="text-xs font-medium truncate">
                    {theme.brand.name}
                  </span>
                </div>
              </div>

              {/* Preview Body */}
              <div className="flex" style={{ height: 'calc(100% - 32px)' }}>
                {/* Preview Sidebar */}
                <div
                  className="border-r bg-gray-50 p-2"
                  style={{ width: `${Math.min(theme.layout.sidebarWidth / 3, 80)}px` }}
                >
                  {['Dashboard', 'Posts', 'Chat', 'Drive'].map((item, i) => (
                    <div
                      key={item}
                      className="text-xs py-1 px-2 rounded mb-1"
                      style={{
                        backgroundColor: i === 0 ? `${theme.colors.primary}20` : 'transparent',
                        color: i === 0 ? theme.colors.primary : '#666',
                        borderRadius: `${theme.layout.borderRadius / 2}px`
                      }}
                    >
                      {item}
                    </div>
                  ))}
                </div>

                {/* Preview Content */}
                <div className="flex-1 p-3">
                  <div
                    className="text-xs font-medium mb-2"
                    style={{ color: theme.colors.primary }}
                  >
                    {theme.brand.tagline}
                  </div>
                  <div className="space-y-2">
                    <div
                      className="h-8 bg-white border p-1"
                      style={{ borderRadius: `${theme.layout.borderRadius / 2}px` }}
                    >
                      <div className="text-xs text-gray-600">Card</div>
                    </div>
                    <button
                      className="text-xs text-white px-2 py-1"
                      style={{
                        backgroundColor: theme.colors.primary,
                        borderRadius: `${theme.layout.borderRadius / 2}px`
                      }}
                    >
                      Button
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Color Swatches */}
            <div className="mt-4">
              <div className="text-sm font-medium mb-2">Farbpalette</div>
              <div className="flex gap-1">
                {Object.entries(theme.colors).map(([key, color]) => (
                  <div
                    key={key}
                    className="w-8 h-8 rounded"
                    style={{ backgroundColor: color }}
                    title={key}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
