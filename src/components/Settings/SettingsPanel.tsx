import { useState } from "react";
import { X, RotateCcw } from "lucide-react";
import { useSettingsStore, type Settings } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsSection = 'general' | 'editor' | 'request' | 'environment';

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const { resetToDefaults } = useSettingsStore();

  if (!isOpen) return null;

  const sections: { id: SettingsSection; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'editor', label: 'Editor' },
    { id: 'request', label: 'Request' },
    { id: 'environment', label: 'Environment' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-card w-[700px] h-[500px] rounded-lg shadow-xl flex overflow-hidden border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className="w-48 border-r border-border bg-muted/30 p-2 flex flex-col">
          <h2 className="font-semibold px-3 py-2 text-lg">Settings</h2>
          <nav className="space-y-1 flex-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm rounded-md transition-colors",
                  activeSection === section.id
                    ? "bg-accent font-medium"
                    : "hover:bg-accent/50"
                )}
              >
                {section.label}
              </button>
            ))}
          </nav>
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to defaults
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h3 className="font-semibold text-lg capitalize">{activeSection}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {activeSection === 'general' && <GeneralSettings />}
            {activeSection === 'editor' && <EditorSettings />}
            {activeSection === 'request' && <RequestSettings />}
            {activeSection === 'environment' && <EnvironmentSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}

// Setting Item component
interface SettingItemProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingItem({ label, description, children }: SettingItemProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-b-0">
      <div className="flex-1 pr-4">
        <div className="font-medium text-sm">{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// Toggle component
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

// General Settings Section
function GeneralSettings() {
  const { theme, autoSave, showWelcome, defaultEditorView, setSetting } = useSettingsStore();

  return (
    <div>
      <SettingItem
        label="Theme"
        description="Choose your preferred color scheme"
      >
        <select
          value={theme}
          onChange={(e) => setSetting('theme', e.target.value as Settings['theme'])}
          className="w-32 px-2 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </SettingItem>

      <SettingItem
        label="Default Editor View"
        description="Preferred view when opening requests from the sidebar"
      >
        <select
          value={defaultEditorView}
          onChange={(e) => setSetting('defaultEditorView', e.target.value as Settings['defaultEditorView'])}
          className="w-28 px-2 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="gui">GUI</option>
          <option value="source">Source</option>
        </select>
      </SettingItem>

      <SettingItem
        label="Auto-save"
        description="Automatically save files after changes"
      >
        <Toggle
          checked={autoSave}
          onChange={(checked) => setSetting('autoSave', checked)}
        />
      </SettingItem>

      <SettingItem
        label="Show Welcome"
        description="Show welcome screen when no files are open"
      >
        <Toggle
          checked={showWelcome}
          onChange={(checked) => setSetting('showWelcome', checked)}
        />
      </SettingItem>
    </div>
  );
}

// Editor Settings Section
function EditorSettings() {
  const {
    fontSize,
    fontFamily,
    tabSize,
    wordWrap,
    lineNumbers,
    minimap,
    setSetting,
  } = useSettingsStore();

  return (
    <div>
      <SettingItem
        label="Font Size"
        description="Editor font size in pixels"
      >
        <input
          type="number"
          value={fontSize}
          onChange={(e) => setSetting('fontSize', Math.max(10, Math.min(24, parseInt(e.target.value) || 14)))}
          min={10}
          max={24}
          className="w-20 px-2 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </SettingItem>

      <SettingItem
        label="Font Family"
        description="Editor font family"
      >
        <select
          value={fontFamily}
          onChange={(e) => setSetting('fontFamily', e.target.value)}
          className="w-44 px-2 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="'JetBrains Mono', 'Fira Code', Consolas, monospace">JetBrains Mono</option>
          <option value="'Fira Code', Consolas, monospace">Fira Code</option>
          <option value="'Source Code Pro', Consolas, monospace">Source Code Pro</option>
          <option value="Consolas, monospace">Consolas</option>
          <option value="monospace">System Mono</option>
        </select>
      </SettingItem>

      <SettingItem
        label="Tab Size"
        description="Number of spaces for indentation"
      >
        <select
          value={tabSize}
          onChange={(e) => setSetting('tabSize', parseInt(e.target.value))}
          className="w-20 px-2 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value={2}>2</option>
          <option value={4}>4</option>
        </select>
      </SettingItem>

      <SettingItem
        label="Word Wrap"
        description="Wrap long lines in the editor"
      >
        <Toggle
          checked={wordWrap === 'on'}
          onChange={(checked) => setSetting('wordWrap', checked ? 'on' : 'off')}
        />
      </SettingItem>

      <SettingItem
        label="Line Numbers"
        description="Show line numbers in the editor"
      >
        <select
          value={lineNumbers}
          onChange={(e) => setSetting('lineNumbers', e.target.value as Settings['lineNumbers'])}
          className="w-28 px-2 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="on">On</option>
          <option value="off">Off</option>
          <option value="relative">Relative</option>
        </select>
      </SettingItem>

      <SettingItem
        label="Minimap"
        description="Show code minimap in the editor"
      >
        <Toggle
          checked={minimap}
          onChange={(checked) => setSetting('minimap', checked)}
        />
      </SettingItem>
    </div>
  );
}

// Request Settings Section
function RequestSettings() {
  const {
    defaultTimeout,
    followRedirects,
    verifySsl,
    maxResponseSize,
    setSetting,
  } = useSettingsStore();

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  };

  return (
    <div>
      <SettingItem
        label="Default Timeout"
        description="Request timeout in milliseconds"
      >
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={defaultTimeout}
            onChange={(e) => setSetting('defaultTimeout', Math.max(1000, parseInt(e.target.value) || 30000))}
            min={1000}
            step={1000}
            className="w-24 px-2 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">ms</span>
        </div>
      </SettingItem>

      <SettingItem
        label="Follow Redirects"
        description="Automatically follow HTTP redirects"
      >
        <Toggle
          checked={followRedirects}
          onChange={(checked) => setSetting('followRedirects', checked)}
        />
      </SettingItem>

      <SettingItem
        label="Verify SSL"
        description="Verify SSL certificates for HTTPS requests"
      >
        <Toggle
          checked={verifySsl}
          onChange={(checked) => setSetting('verifySsl', checked)}
        />
      </SettingItem>

      <SettingItem
        label="Max Response Size"
        description={`Maximum response size to display (current: ${formatSize(maxResponseSize)})`}
      >
        <select
          value={maxResponseSize}
          onChange={(e) => setSetting('maxResponseSize', parseInt(e.target.value))}
          className="w-28 px-2 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value={1024 * 1024}>1 MB</option>
          <option value={5 * 1024 * 1024}>5 MB</option>
          <option value={10 * 1024 * 1024}>10 MB</option>
          <option value={50 * 1024 * 1024}>50 MB</option>
        </select>
      </SettingItem>
    </div>
  );
}

// Environment Settings Section
function EnvironmentSettings() {
  const {
    autoLoadEnv,
    showVariableHints,
    maskSensitiveValues,
    setSetting,
  } = useSettingsStore();

  return (
    <div>
      <SettingItem
        label="Auto-load Environments"
        description="Automatically load environment files when opening a workspace"
      >
        <Toggle
          checked={autoLoadEnv}
          onChange={(checked) => setSetting('autoLoadEnv', checked)}
        />
      </SettingItem>

      <SettingItem
        label="Show Variable Hints"
        description="Show variable value hints in the editor on hover"
      >
        <Toggle
          checked={showVariableHints}
          onChange={(checked) => setSetting('showVariableHints', checked)}
        />
      </SettingItem>

      <SettingItem
        label="Mask Sensitive Values"
        description="Hide sensitive values (tokens, passwords, API keys) in the UI"
      >
        <Toggle
          checked={maskSensitiveValues}
          onChange={(checked) => setSetting('maskSensitiveValues', checked)}
        />
      </SettingItem>
    </div>
  );
}
