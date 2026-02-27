import { PanelLeft, Sun, Moon } from 'lucide-react';
import { useThemeStore } from '@/store/useThemeStore';
import { useLayoutStore } from '@/store/useLayoutStore';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  backButton?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, icon, backButton, actions }: PageHeaderProps) {
  const { theme, toggleTheme } = useThemeStore();
  const { isSidebarCollapsed, toggleSidebar } = useLayoutStore();

  return (
    <header className="shrink-0 bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800 px-6 py-4 transition-colors duration-300">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-300 cursor-pointer"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <PanelLeft className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
          </button>

          {backButton}

          {icon && (
            <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800">
              {icon}
            </div>
          )}

          <div className="min-w-0">
            <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 truncate">{title}</h1>
            {subtitle && <p className="text-[12px] text-neutral-400 dark:text-neutral-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleTheme}
            className="relative p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-300 cursor-pointer group"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            <div className="relative w-4 h-4">
              <Sun
                className={`w-4 h-4 text-amber-500 transition-all duration-300 absolute inset-0 ${
                  theme === 'light' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-0'
                }`}
              />
              <Moon
                className={`w-4 h-4 text-blue-400 transition-all duration-300 absolute inset-0 ${
                  theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
                }`}
              />
            </div>
          </button>

          {actions}
        </div>
      </div>
    </header>
  );
}
