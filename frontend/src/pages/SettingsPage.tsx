import { PageHeader } from '@/components/layout/PageHeader';

export function SettingsPage() {
  return (
    <div className="flex-1 flex flex-col h-screen max-h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950 transition-colors duration-300">
      <PageHeader title="Settings" subtitle="Project and profile configuration" />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 p-6">
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
            Settings Placeholder
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            This page is ready for future app settings (profile, integrations, notifications).
          </p>
        </div>
      </div>
    </div>
  );
}
