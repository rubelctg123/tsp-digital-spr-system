import React, { useState, useEffect } from 'react';
import { User, SprRecord, RealtimeEvent } from './types';
import { AppStore } from './services/store';
import { Header } from './components/Header';
import { Sidebar, NavView } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { SprForm } from './components/SprForm';
import { SprRecords } from './components/SprRecords';
import { MaterialMaster } from './components/MaterialMaster';
import { AdminUsers } from './components/AdminUsers';
import { UserProfile } from './components/UserProfile';
import { PrintSprDocument } from './components/PrintSprDocument';
import { AuthModal } from './components/AuthModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { TspLogo } from './components/TspLogo';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => AppStore.getCurrentUser());
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isResetPasswordMode, setIsResetPasswordMode] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<NavView>('dashboard');
  const [activeSpr, setActiveSpr] = useState<SprRecord | null>(null);
  const [isViewingDocument, setIsViewingDocument] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Initialize storage & detect auth session
  useEffect(() => {
    AppStore.init();

    // 1. Check if URL indicates password recovery mode
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    if (hash.includes('type=recovery') || search.includes('type=recovery')) {
      setIsResetPasswordMode(true);
    }

    // 2. Validate current Supabase session
    AppStore.checkAuthSession()
      .then((user) => {
        setCurrentUser(user);
      })
      .finally(() => {
        setIsAuthLoading(false);
      });

    // 3. Set up Supabase Auth state listener
    const unsubscribeAuth = AppStore.setupAuthListener((user, event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResetPasswordMode(true);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setIsAuthModalOpen(false);
      } else if (user) {
        setCurrentUser(user);
      }
    });

    // 4. Set up cross-tab real-time event listener
    const unsubscribeRealtime = AppStore.subscribe((event: RealtimeEvent) => {
      if (event.type === 'USER_UPDATED') {
        const updated = AppStore.getCurrentUser();
        setCurrentUser(updated);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeRealtime();
    };
  }, []);

  // Handlers
  const handleLogout = async () => {
    try {
      await AppStore.logoutUser();
    } catch (err) {
      console.warn('Logout error:', err);
    }
    setCurrentUser(null);
    setIsAuthModalOpen(false);
    setIsViewingDocument(false);
    setActiveSpr(null);
    setCurrentView('dashboard');
  };

  const handleNewSpr = () => {
    setActiveSpr(null);
    setIsViewingDocument(false);
    setCurrentView('new-spr');
  };

  const handleEditSpr = (spr: SprRecord) => {
    setActiveSpr(spr);
    setIsViewingDocument(false);
    setCurrentView('new-spr');
  };

  const handleViewSpr = (spr: SprRecord) => {
    setActiveSpr(spr);
    setIsViewingDocument(true);
  };

  const handleSprSaveSuccess = (saved: SprRecord) => {
    setActiveSpr(saved);
    setIsViewingDocument(true);
  };

  // Initial Auth Loading Screen
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="inline-flex p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 shadow-xl animate-pulse">
            <TspLogo size={56} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wide text-white">
              TSP COMPLEX LTD. (BCIC)
            </h1>
            <p className="text-xs text-emerald-300 font-medium mt-0.5">
              Digital Store Purchase Requisition (SPR) System
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-300">Checking secure session...</span>
          </div>
        </div>
      </div>
    );
  }

  // Password Recovery Flow
  if (isResetPasswordMode) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <Header
          currentUser={currentUser}
          onOpenAuthModal={() => {}}
        />
        <ResetPasswordModal
          onSuccess={() => {
            setIsResetPasswordMode(false);
            window.location.hash = '';
          }}
          onCancel={() => {
            setIsResetPasswordMode(false);
            window.location.hash = '';
          }}
        />
      </div>
    );
  }

  // Unauthenticated State -> Enforce Corporate Login Screen (Cannot be bypassed)
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-between">
        <Header
          currentUser={null}
          onOpenAuthModal={() => {}}
        />
        <div className="flex-1 flex items-center justify-center p-4">
          <AuthModal
            currentUser={null}
            isMandatory={true}
            onLoginSuccess={(user) => {
              setCurrentUser(user);
              setIsAuthModalOpen(false);
            }}
          />
        </div>
        <footer className="text-center py-3 text-[11px] text-slate-400 bg-slate-950 border-t border-slate-800">
          TSP Complex Ltd. • Bangladesh Chemical Industries Corporation (BCIC) • All Rights Reserved
        </footer>
      </div>
    );
  }

  // Authenticated State -> Protected Enterprise Application
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900">
      {/* Top Application Header */}
      <Header
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Body */}
      <div className="flex flex-1">
        {/* Left Sidebar (hidden during printing) */}
        {!isViewingDocument && (
          <Sidebar
            currentView={currentView}
            onNavigate={(view) => {
              // Standard users cannot access admin-only views
              if (view === 'admin-users' && currentUser.role !== 'admin' && currentUser.email?.toLowerCase() !== 'admin@tsp.gov.bd' && currentUser.email?.toLowerCase() !== 'rubelctg1237@gmail.com') {
                return;
              }
              setIsViewingDocument(false);
              setActiveSpr(null);
              setCurrentView(view);
            }}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        )}

        {/* Center Main Stage */}
        <main
          className={`flex-1 overflow-y-auto ${
            isViewingDocument
              ? 'bg-slate-200/80 p-2 sm:p-4'
              : currentView === 'new-spr'
              ? 'p-2 sm:p-3 lg:p-4'
              : 'p-4 sm:p-6 lg:p-8'
          }`}
        >
          {isViewingDocument && activeSpr ? (
            <PrintSprDocument
              spr={activeSpr}
              onBack={() => {
                setIsViewingDocument(false);
                setCurrentView('spr-records');
              }}
            />
          ) : currentView === 'dashboard' ? (
            <Dashboard
              currentUser={currentUser}
              onNewSpr={handleNewSpr}
              onViewSpr={handleViewSpr}
              onEditSpr={handleEditSpr}
              onNavigateToRecords={() => setCurrentView('spr-records')}
              onNavigateToMaterials={() => setCurrentView('materials')}
            />
          ) : currentView === 'new-spr' ? (
            <SprForm
              initialSpr={activeSpr}
              currentUser={currentUser}
              onSaveSuccess={handleSprSaveSuccess}
              onCancel={() => setCurrentView('spr-records')}
            />
          ) : currentView === 'spr-records' ? (
            <SprRecords
              currentUser={currentUser}
              onNewSpr={handleNewSpr}
              onViewSpr={handleViewSpr}
              onEditSpr={handleEditSpr}
            />
          ) : currentView === 'materials' ? (
            <MaterialMaster currentUser={currentUser} />
          ) : currentView === 'admin-users' && (currentUser.role === 'admin' || currentUser.email?.toLowerCase() === 'admin@tsp.gov.bd' || currentUser.email?.toLowerCase() === 'rubelctg1237@gmail.com') ? (
            <AdminUsers currentUser={currentUser} />
          ) : currentView === 'profile' ? (
            <UserProfile
              currentUser={currentUser}
              onUpdateProfile={(updated) => setCurrentUser(updated)}
            />
          ) : (
            <Dashboard
              currentUser={currentUser}
              onNewSpr={handleNewSpr}
              onViewSpr={handleViewSpr}
              onEditSpr={handleEditSpr}
              onNavigateToRecords={() => setCurrentView('spr-records')}
              onNavigateToMaterials={() => setCurrentView('materials')}
            />
          )}
        </main>
      </div>

      {/* Account Switch Modal for Authenticated Users */}
      {isAuthModalOpen && (
        <AuthModal
          currentUser={currentUser}
          isMandatory={false}
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            setIsAuthModalOpen(false);
          }}
          onClose={() => setIsAuthModalOpen(false)}
        />
      )}
    </div>
  );
}
