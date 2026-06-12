
import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
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

  const { scrollY } = useScroll();

  // Dynamic transform values for smooth gradual collapse on scroll (0px to 200px scroll distance)
  const elementsOpacity = useTransform(scrollY, [0, 150], [1, 0]);
  const logoX = useTransform(scrollY, [0, 150], [0, -20]);
  const authX = useTransform(scrollY, [0, 150], [0, 20]);
  const linksWidth = useTransform(scrollY, [0, 150], [420, 0]); // Estimated width of the 4 links

  // Create a boolean-like state for pointer-events to prevent clicking hidden items
  const pointerEvents = useTransform(scrollY, [0, 100], ["auto", "none"]);

  return (
    <div className="min-h-screen w-full bg-black text-cream font-sans overflow-hidden relative selection:bg-cherry selection:text-white">
      {/* Texture Grain */}
      <div className="fixed inset-0 opacity-[0.05] pointer-events-none z-0"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
      </div>

      {/* Atmospheric Glows - Subtle Cherry on Black */}
      <div className="fixed top-[-20%] left-[10%] w-[50vw] h-[50vw] bg-cherry/10 blur-[150px] pointer-events-none z-0 mix-blend-screen" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-cherry/5 blur-[120px] pointer-events-none z-0 mix-blend-screen" />

      {/* Navigation */}
      {isAppView ? (
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
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-4 animate-in fade-in slide-in-from-right-4 duration-500">
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

                    {/* Dropdown Menu */}
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
      ) : (
        <nav className="fixed top-4 inset-x-0 px-8 lg:px-16 z-50 flex items-center justify-between pointer-events-none">
          <motion.div
            style={{ opacity: elementsOpacity, x: logoX, pointerEvents: pointerEvents as any }}
            className="flex items-center gap-4 cursor-pointer"
            onClick={() => setCurrentView('LANDING')}
          >
            {/* Logo */}
            <div className="w-12 h-12 rounded-full liquid-glass flex items-center justify-center border border-white/10">
              <span className="font-serif italic lowercase text-2xl text-white">a</span>
            </div>
            {/* Title */}
            <div className="hidden md:flex items-center">
              <span className="text-xl font-medium tracking-tight text-white select-none">Aether</span>
              <span className="text-cherry text-2xl leading-none ml-1 font-serif italic">*</span>
            </div>
          </motion.div>

          <div className="hidden md:flex items-center p-1.5 rounded-full liquid-glass pointer-events-auto border border-white/5">
            <motion.div
              style={{ width: linksWidth, opacity: elementsOpacity }}
              className="flex items-center overflow-hidden"
            >
              <button onClick={() => setCurrentView('PLATFORM_OBSERVABILITY')} className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/5 rounded-full transition-colors whitespace-nowrap">Platform</button>
              <button onClick={() => setCurrentView('PLATFORM_OBSERVABILITY')} className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/5 rounded-full transition-colors whitespace-nowrap">Observability</button>
              <button onClick={() => setCurrentView('COMPANY_ENTERPRISE')} className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/5 rounded-full transition-colors whitespace-nowrap">Enterprise</button>
              <button onClick={() => setCurrentView('PLATFORM_CHANGELOG')} className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/5 rounded-full transition-colors whitespace-nowrap">Changelog</button>
            </motion.div>
            <motion.button
              onClick={() => setCurrentView('BUILDER')}
              className="px-5 py-2 text-sm font-bold text-black bg-white rounded-full flex items-center gap-2 hover:bg-cream transition-colors whitespace-nowrap"
            >
              Deploy Console <ArrowUpRight className="w-4 h-4" />
            </motion.button>
          </div>

          <motion.div
            style={{ opacity: elementsOpacity, x: authX, pointerEvents: pointerEvents as any }}
            className="flex items-center gap-3"
          >
            {user ? (
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
                <div className="absolute right-0 top-full pt-2 w-48 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all transform translate-y-2 group-hover:translate-y-0 flex flex-col z-40">
                  <div className="liquid-glass rounded-xl shadow-2xl p-1 flex flex-col gap-0.5 border border-white/10">
                    <button onClick={() => setCurrentView('BUILDER')} className="w-full text-left px-3 py-2 text-xs font-bold text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2">
                      <Terminal className="w-3 h-3" /> Go to Console
                    </button>
                    <button onClick={() => setCurrentView('PROFILE')} className="w-full text-left px-3 py-2 text-xs font-bold text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2">
                      <UserIcon className="w-3 h-3" /> Profile Settings
                    </button>
                    <div className="h-px bg-white/5 my-1" />
                    <button onClick={onLogout} className="w-full text-left px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2">
                      <LogOut className="w-3 h-3" /> Sign Out
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setCurrentView('AUTH')}
                  className="text-xs font-bold uppercase tracking-widest text-white/70 hover:text-white transition-colors px-4 py-2 hover:bg-white/5 rounded-full hidden sm:block"
                >
                  Log In
                </button>
                <button
                  onClick={() => setCurrentView('AUTH')}
                  className="bg-white text-black px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-cream hover:scale-105 transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]"
                >
                  Sign Up
                </button>
              </>
            )}
          </motion.div>
        </nav>
      )}

      {/* Main Content Area */}
      <main className="relative min-h-screen">
        {children}
      </main>
    </div>
  );
};
