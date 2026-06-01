
import React from 'react';
import { Layers, Github, ArrowUpRight, LogOut, Terminal, User as UserIcon } from 'lucide-react';
import { View, User } from '../types';

interface LayoutProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  children: React.ReactNode;
  user?: User | null;
  onLogout?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ currentView, setCurrentView, children, user, onLogout }) => {
  const isAppView = currentView === 'BUILDER' || currentView === 'DEPLOYMENTS' || currentView === 'PROFILE' || currentView === 'EXECUTIONS';

  return (
    <div className="min-h-screen w-full bg-black text-cream font-sans overflow-hidden relative selection:bg-cherry selection:text-white">
      {/* Texture Grain */}
      <div className="fixed inset-0 opacity-[0.05] pointer-events-none z-0" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
      </div>

      {/* Atmospheric Glows - Subtle Cherry on Black */}
      <div className="fixed top-[-20%] left-[10%] w-[50vw] h-[50vw] bg-cherry/10 blur-[150px] pointer-events-none z-0 mix-blend-screen" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-cherry/5 blur-[120px] pointer-events-none z-0 mix-blend-screen" />

      {/* Capsule Navigation */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl transition-all duration-500">
        <div className="glass-capsule mx-4 px-2 pl-6 pr-2 h-14 rounded-full flex items-center justify-between shadow-2xl shadow-black/50">
          
          {/* Logo Section */}
          <div 
            className="flex items-center gap-3 cursor-pointer group mr-8"
            onClick={() => setCurrentView('LANDING')}
          >
            <div className="w-6 h-6 bg-gradient-to-br from-cherry to-red-900 rounded-full flex items-center justify-center shadow-lg shadow-cherry/20 group-hover:scale-110 transition-transform duration-500">
              <Layers className="text-white w-3 h-3" />
            </div>
            <span className="font-serif italic font-bold text-lg tracking-tight text-cream group-hover:text-white transition-colors">
              Aether
            </span>
          </div>

          {/* Center Navigation Links */}
          <div className="hidden md:flex items-center justify-center flex-1">
            {isAppView ? (
               <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/5 transition-all animate-in fade-in zoom-in duration-300">
                <button 
                  onClick={() => setCurrentView('BUILDER')}
                  className={`px-5 py-1.5 rounded-full text-xs font-medium tracking-wide transition-all ${currentView === 'BUILDER' ? 'bg-cream text-black font-bold shadow-lg' : 'text-cream/60 hover:text-cream hover:bg-white/5'}`}
                >
                  Workflows
                </button>
                <button 
                  onClick={() => setCurrentView('EXECUTIONS')}
                  className={`px-5 py-1.5 rounded-full text-xs font-medium tracking-wide transition-all ${currentView === 'EXECUTIONS' ? 'bg-cream text-black font-bold shadow-lg' : 'text-cream/60 hover:text-cream hover:bg-white/5'}`}
                >
                  Runs
                </button>
                <button 
                  onClick={() => setCurrentView('DEPLOYMENTS')}
                  className={`px-5 py-1.5 rounded-full text-xs font-medium tracking-wide transition-all ${currentView === 'DEPLOYMENTS' ? 'bg-cream text-black font-bold shadow-lg' : 'text-cream/60 hover:text-cream hover:bg-white/5'}`}
                >
                  Deploy
                </button>
              </div>
            ) : (
               <div className="flex items-center gap-8 animate-in fade-in slide-in-from-top-2 duration-500">
                 <button 
                   onClick={() => setCurrentView('LANDING')}
                   className="text-xs font-bold uppercase tracking-widest text-cream/50 hover:text-white transition-colors relative group"
                 >
                    Features
                    <span className="absolute -bottom-1 left-0 w-0 h-px bg-cherry transition-all duration-300 group-hover:w-full"></span>
                 </button>
                 <button 
                    onClick={() => setCurrentView('ARCHITECTURE')}
                    className="text-xs font-bold uppercase tracking-widest text-cream/50 hover:text-white transition-colors relative group"
                 >
                    Architecture
                    <span className="absolute -bottom-1 left-0 w-0 h-px bg-cherry transition-all duration-300 group-hover:w-full"></span>
                 </button>
                 <button 
                    onClick={() => setCurrentView('LANDING')}
                    className="text-xs font-bold uppercase tracking-widest text-cream/50 hover:text-white transition-colors relative group"
                 >
                    Pricing
                    <span className="absolute -bottom-1 left-0 w-0 h-px bg-cherry transition-all duration-300 group-hover:w-full"></span>
                 </button>
                 <button 
                    onClick={() => setCurrentView('PLATFORM_CHANGELOG')}
                    className="text-xs font-bold uppercase tracking-widest text-cream/50 hover:text-white transition-colors relative group"
                 >
                    Changelog
                    <span className="absolute -bottom-1 left-0 w-0 h-px bg-cherry transition-all duration-300 group-hover:w-full"></span>
                 </button>
               </div>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
             {user ? (
                /* Authenticated User State */
                <div className="flex items-center gap-4 animate-in fade-in slide-in-from-right-4 duration-500">
                   {!isAppView && (
                      <button 
                        onClick={() => setCurrentView('BUILDER')}
                        className="hidden sm:flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cream/60 hover:text-white transition-colors"
                      >
                         <Terminal className="w-3 h-3" /> Console
                      </button>
                   )}
                   <div className="h-4 w-px bg-white/10 hidden sm:block"></div>
                   
                   <div className="group relative py-2">
                      <div className="flex items-center gap-3 cursor-pointer p-1 rounded-full hover:bg-white/5 transition-colors border border-transparent hover:border-white/10 relative z-50">
                          <div className="text-right hidden sm:block">
                             <div className="text-[11px] font-bold text-white leading-tight">{user.name}</div>
                             <div className="text-[9px] text-gray-500 font-mono leading-tight">Pro Plan</div>
                          </div>
                          <img 
                            src={user.avatar} 
                            alt={user.name} 
                            className="w-8 h-8 rounded-full border border-white/10 bg-white/5 object-cover" 
                          />
                      </div>

                      {/* Dropdown Menu - Using PT-2 instead of MT-2 to bridge the gap */}
                      <div className="absolute right-0 top-full pt-2 w-48 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all transform translate-y-2 group-hover:translate-y-0 flex flex-col z-40">
                          <div className="glass-panel rounded-xl shadow-2xl p-1 flex flex-col gap-0.5">
                            <button onClick={() => setCurrentView('BUILDER')} className="w-full text-left px-3 py-2 text-xs font-bold text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2">
                                <Terminal className="w-3 h-3" /> Go to Console
                            </button>
                            <button 
                                onClick={() => setCurrentView('PROFILE')}
                                className="w-full text-left px-3 py-2 text-xs font-bold text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <UserIcon className="w-3 h-3" /> Profile Settings
                            </button>
                            <div className="h-px bg-white/5 my-1" />
                            <button 
                                onClick={onLogout} 
                                className="w-full text-left px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <LogOut className="w-3 h-3" /> Sign Out
                            </button>
                          </div>
                      </div>
                   </div>
                </div>
             ) : (
               /* Guest State */
               <>
                 <button 
                   onClick={() => setCurrentView('AUTH')}
                   className="text-xs font-bold uppercase tracking-widest text-cream/60 hover:text-white transition-colors px-4 py-2 hover:bg-white/5 rounded-full hidden sm:block"
                 >
                   Log In
                 </button>
                 <button 
                   onClick={() => setCurrentView('AUTH')}
                   className="bg-cream text-black px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-white hover:scale-105 transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] border border-white/50"
                 >
                   Sign Up
                 </button>
               </>
             )}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="relative min-h-screen">
        {children}
      </main>
    </div>
  );
};
