import React from 'react';
import { NavLink } from 'react-router-dom';
import { Video as LucideIcon } from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

interface DashboardSidebarProps {
  items: NavItem[];
  title?: string;
}

export function DashboardSidebar({ items, title }: DashboardSidebarProps) {
  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-3">
      {title && <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wide px-3 py-2">{title}</p>}
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-900/40 text-blue-400'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              }`
            }
          >
            <item.icon size={16} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
