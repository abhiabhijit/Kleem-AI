import React from 'react';
import { ViewState } from '../types';

interface LayoutProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  children: React.ReactNode;
}

const NavItem = ({ 
  label, 
  icon, 
  active, 
  onClick 
}: { 
  label: string; 
  icon: string; 
  active: boolean; 
  onClick: () => void 
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      active 
        ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' 
        : 'text-slate-600 hover:bg-slate-100'
    }`}
  >
    <span className="material-symbols-outlined text-xl">{icon}</span>
    <span className="font-medium text-sm">{label}</span>
  </button>
);

export const Layout: React.FC<LayoutProps> = ({ currentView, onNavigate, children }) => {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
      
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col justify-between p-4 z-20">
        <div>
            <div className="flex items-center space-x-2 px-4 mb-8 pt-2">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-lg">school</span>
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Kleem AI</h1>
            </div>

            <nav className="space-y-1">
            <NavItem 
                label="Dashboard" 
                icon="dashboard" 
                active={currentView === ViewState.DASHBOARD} 
                onClick={() => onNavigate(ViewState.DASHBOARD)} 
            />
            <NavItem 
                label="Study Chat" 
                icon="chat_bubble" 
                active={currentView === ViewState.CHAT_STUDY} 
                onClick={() => onNavigate(ViewState.CHAT_STUDY)} 
            />
            <NavItem 
                label="Exam Prep" 
                icon="psychology" 
                active={currentView === ViewState.EXAM_PREP} 
                onClick={() => onNavigate(ViewState.EXAM_PREP)} 
            />
            <NavItem 
                label="Live Session" 
                icon="mic" 
                active={currentView === ViewState.LIVE_SESSION} 
                onClick={() => onNavigate(ViewState.LIVE_SESSION)} 
            />
            <NavItem 
                label="Media Lab" 
                icon="perm_media" 
                active={currentView === ViewState.MEDIA_LAB} 
                onClick={() => onNavigate(ViewState.MEDIA_LAB)} 
            />
            </nav>
        </div>
        
        <div className="p-4 bg-brand-50 rounded-xl">
            <h3 className="text-xs font-bold text-brand-800 uppercase tracking-wide mb-1">Status</h3>
            <p className="text-xs text-brand-600">All Systems Operational</p>
            <div className="mt-2 flex items-center space-x-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-[10px] text-brand-500 font-medium">Gemini 2.5 Flash & Pro</span>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {children}
      </main>
    </div>
  );
};
