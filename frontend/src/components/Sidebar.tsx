import { NavLink } from "react-router-dom";
import { LayoutGrid, Briefcase, Users, Settings, LogOut } from "lucide-react";

export function Sidebar() {
  const menuItems = [
    { id: "home", label: "Board", icon: LayoutGrid, path: "/" },
    { id: "jobs", label: "Jobs", icon: Briefcase, path: "/jobs" },
    { id: "candidates", label: "Candidates", icon: Users, path: "/candidates" },
  ];

  return (
    <aside className="w-64 shrink-0 flex flex-col border-r border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 transition-colors duration-300">
      {/* Logo Section */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-sm">
          CM
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-bold text-neutral-900 dark:text-neutral-100 tracking-tight leading-none">
            CVMaster
          </h2>
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium mt-1 uppercase tracking-wider">
            Smart ATS
          </p>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) => `
                w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all
                ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                }
              `}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-4 h-4 ${isActive ? "text-blue-600 dark:text-blue-400" : ""}`}
                  />
                  {item.label}
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="px-3 py-4 border-t border-neutral-100 dark:border-neutral-800 space-y-1">
        <NavLink
          to="/settings"
          className={({ isActive }) => `
            w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all
            ${isActive ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white" : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"}
          `}
        >
          <Settings className="w-4 h-4" />
          Settings
        </NavLink>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer">
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
