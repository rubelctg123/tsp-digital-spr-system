import React from 'react';
import { User } from '../types';
import {
  LayoutDashboard,
  PlusCircle,
  FileSpreadsheet,
  Package,
  Users,
  UserCircle,
  LogOut,
} from 'lucide-react';

export type NavView = 'dashboard' | 'new-spr' | 'spr-records' | 'materials' | 'admin-users' | 'profile';

interface SidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  currentUser: User;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  currentUser,
  onLogout,
}) => {
  const isAdmin = currentUser.role === 'admin';

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 border-r border-slate-800 min-h-[calc(100vh-4rem)] p-4 no-print select-none">
      <div className="space-y-6">
        {/* Main Action Button */}
        <div>
          <button
            id="nav-new-spr-btn"
            onClick={() => onNavigate('new-spr')}
            className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm ${
              currentView === 'new-spr'
                ? 'bg-emerald-500 text-slate-950 font-black'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            + New SPR (নতুন এসপিআর)
          </button>
        </div>

        {/* Primary Navigation */}
        <div className="space-y-1">
          <span className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            General Navigation
          </span>

          <button
            id="nav-dashboard-btn"
            onClick={() => onNavigate('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
              currentView === 'dashboard'
                ? 'bg-slate-800 text-emerald-400 font-bold border-l-2 border-emerald-400'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>

          <button
            id="nav-spr-records-btn"
            onClick={() => onNavigate('spr-records')}
            className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
              currentView === 'spr-records'
                ? 'bg-slate-800 text-emerald-400 font-bold border-l-2 border-emerald-400'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            SPR Records
          </button>

          <button
            id="nav-materials-btn"
            onClick={() => onNavigate('materials')}
            className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
              currentView === 'materials'
                ? 'bg-slate-800 text-emerald-400 font-bold border-l-2 border-emerald-400'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            Materials Master
          </button>
        </div>

        {/* Admin Navigation (Section 30: Only visible for Admin) */}
        {isAdmin && (
          <div className="space-y-1 pt-3 border-t border-slate-800">
            <span className="px-3 text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-1">
              Admin Controls
            </span>

            <button
              id="nav-admin-users-btn"
              onClick={() => onNavigate('admin-users')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
                currentView === 'admin-users'
                  ? 'bg-slate-800 text-purple-300 font-bold border-l-2 border-purple-400'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4 text-purple-400" />
              User Management
            </button>

            <button
              id="nav-admin-materials-btn"
              onClick={() => onNavigate('materials')}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-md text-slate-300 hover:bg-slate-800/60 hover:text-white transition-colors"
            >
              <Package className="w-4 h-4 text-purple-400" />
              Material Master Admin
            </button>
          </div>
        )}

        {/* Account & Profile */}
        <div className="space-y-1 pt-3 border-t border-slate-800">
          <span className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Account
          </span>

          <button
            id="nav-profile-btn"
            onClick={() => onNavigate('profile')}
            className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
              currentView === 'profile'
                ? 'bg-slate-800 text-emerald-400 font-bold border-l-2 border-emerald-400'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <UserCircle className="w-4 h-4" />
            Profile &amp; Settings
          </button>
        </div>
      </div>

      {/* Bottom Footer Area */}
      <div className="pt-4 border-t border-slate-800">
        <button
          id="nav-logout-btn"
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Switch / Logout
        </button>
      </div>
    </aside>
  );
};
