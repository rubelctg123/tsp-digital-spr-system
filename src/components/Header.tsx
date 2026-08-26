import React from 'react';
import { User } from '../types';
import { TspLogo } from './TspLogo';
import { Shield, User as UserIcon, LogOut, UserCheck } from 'lucide-react';

interface HeaderProps {
  currentUser: User | null;
  onOpenAuthModal: () => void;
  onLogout?: () => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenAuthModal,
  onLogout,
}) => {
  return (
    <header className="bg-emerald-900 text-white border-b border-emerald-950 sticky top-0 z-30 shadow-md no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Left Brand Title with High-Contrast Logo Badge */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white p-1 shadow-sm border-2 border-emerald-300 flex items-center justify-center shrink-0">
            <TspLogo size={32} className="text-emerald-900" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-wide text-white drop-shadow-xs">
                টিএসপি কমপ্লেক্স লিঃ
              </span>
              <span className="text-[11px] text-amber-300 font-semibold px-1.5 py-0.5 bg-emerald-950/70 border border-emerald-700/60 rounded hidden sm:inline">
                BCIC
              </span>
            </div>
            <div className="text-[11px] text-emerald-100/90 font-medium tracking-wider">
              TSP COMPLEX LTD. • DIGITAL SPR SYSTEM
            </div>
          </div>
        </div>

        {/* Right Info & Profile */}
        {currentUser && (
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Current User Pill */}
            <button
              id="header-user-badge"
              onClick={onOpenAuthModal}
              title="Click to Switch Account or view user details"
              className="flex items-center gap-2.5 px-3 py-1.5 bg-emerald-800/90 hover:bg-emerald-700 active:bg-emerald-600 rounded-lg border border-emerald-700 transition-colors text-left cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-amber-400 text-emerald-950 flex items-center justify-center font-bold text-xs shadow-xs">
                {currentUser.name.charAt(0)}
              </div>
              <div className="hidden md:block">
                <div className="text-xs font-bold text-white leading-tight flex items-center gap-1.5">
                  {currentUser.name}
                  {currentUser.role === 'admin' && (
                    <span className="px-1.5 py-0.2 bg-amber-300 text-emerald-950 rounded text-[9px] uppercase font-extrabold">
                      Admin
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-mono text-emerald-200 leading-tight">
                  {currentUser.userId} • {currentUser.email}
                </div>
              </div>
            </button>

            {/* Direct Logout Button */}
            {onLogout && (
              <button
                id="header-logout-btn"
                onClick={onLogout}
                title="Sign Out of Session (লগআউট)"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-900/60 hover:bg-rose-800 text-rose-100 rounded-lg border border-rose-700/60 transition-colors text-xs font-bold cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
