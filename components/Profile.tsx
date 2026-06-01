
import React, { useMemo } from 'react';
import { User, View, WorkflowNode, NodeType } from '../types';
import { ArrowRight, Shield, Key, Zap, Clock, Mail, Workflow, Bot, Globe, Plug } from 'lucide-react';
import { storageService } from '../services/storageService';

interface ProfileProps {
  user: User;
  onNavigate: (view: View) => void;
  nodes: WorkflowNode[];
}

export const Profile: React.FC<ProfileProps> = ({ user, onNavigate, nodes }) => {
  
  // Calculate REAL stats from actual data
  const stats = useMemo(() => {
     const agentCount = nodes.filter(n => n.type === NodeType.AGENT).length;
     const triggerCount = nodes.filter(n => n.type === NodeType.TRIGGER || n.type === NodeType.WEBHOOK).length;
     const totalNodes = nodes.length;
     
     // Get real execution count from storage
     const userData = storageService.getUserData(user.email);
     const executionCount = userData?.executions?.length || 0;
     const deploymentCount = userData?.deployments?.length || 0;
     const workflowCount = userData?.workflows?.length || 0;
     
     // Count integration nodes
     const integrationModels = ['ddg-search', 'rss-reader', 'github-api', 'telegram-bot', 'notion', 'discord', 'google-sheets', 'firebase'];
     const integrationCount = nodes.filter(n => integrationModels.includes(n.data.model || '')).length;
     
     // Count nodes with custom API keys
     const customKeyCount = nodes.filter(n => n.data.customApiKey).length;
     
     return { agentCount, triggerCount, totalNodes, executionCount, deploymentCount, workflowCount, integrationCount, customKeyCount };
  }, [nodes, user.email]);

  return (
    <div className="min-h-screen pt-32 pb-12 px-6 flex justify-center">
       <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Breadcrumb */}
          <button 
            onClick={() => onNavigate('BUILDER')}
            className="text-xs font-mono text-gray-500 hover:text-white mb-8 flex items-center gap-2 uppercase tracking-widest transition-colors"
          >
             <ArrowRight className="w-3 h-3 rotate-180" /> Back to Console
          </button>

          {/* --- HEADER SECTION --- */}
          <div className="relative group rounded-3xl mb-12">
              <div className="absolute inset-0 bg-gradient-to-r from-cherry/10 to-transparent rounded-3xl blur-xl opacity-50 pointer-events-none"></div>
              <div className="glass-panel p-8 md:p-12 rounded-3xl relative z-10 overflow-hidden">
                   {/* Background Decor */}
                   <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-b from-white/5 to-transparent blur-[100px] rounded-full pointer-events-none"></div>

                   <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                       <div className="relative">
                            <div className="absolute -inset-1 bg-gradient-to-br from-cherry to-violet-600 rounded-full blur opacity-40"></div>
                            <img 
                                src={user.avatar} 
                                alt={user.name} 
                                className="relative w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-white/10 bg-black object-cover shadow-2xl" 
                            />
                            <div className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 border-4 border-black rounded-full" title="Online"></div>
                       </div>
                       
                       <div className="flex-1 text-center md:text-left">
                           <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-4">
                               <div>
                                    <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-2">{user.name}</h1>
                                    <div className="flex items-center justify-center md:justify-start gap-4 text-sm text-gray-400 font-mono mb-4">
                                        <span className="flex items-center gap-2"><Mail className="w-3 h-3" /> {user.email}</span>
                                        <span className="hidden md:inline text-white/10">|</span>
                                        <span className="flex items-center gap-2"><Shield className="w-3 h-3 text-cherry" /> ID: {user.id}</span>
                                    </div>
                               </div>
                           </div>
                           
                           {/* Mini Stats in Header */}
                           <div className="mt-6 flex flex-wrap gap-2 justify-center md:justify-start">
                               <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] uppercase tracking-wide text-gray-300">
                                 Free Plan
                               </span>
                               <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] uppercase tracking-wide text-gray-300">Member since {user.joinedAt || 'Recently'}</span>
                           </div>
                       </div>
                   </div>
              </div>
          </div>

          {/* --- REAL STATS GRID --- */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              <div className="glass-panel p-5 rounded-2xl text-center">
                  <Bot className="w-5 h-5 text-cherry mx-auto mb-2" />
                  <div className="text-2xl font-display font-bold text-white">{stats.agentCount}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">AI Agents</div>
              </div>
              <div className="glass-panel p-5 rounded-2xl text-center">
                  <Zap className="w-5 h-5 text-yellow-400 mx-auto mb-2" />
                  <div className="text-2xl font-display font-bold text-white">{stats.executionCount}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Executions</div>
              </div>
              <div className="glass-panel p-5 rounded-2xl text-center">
                  <Workflow className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                  <div className="text-2xl font-display font-bold text-white">{stats.deploymentCount}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Deployments</div>
              </div>
              <div className="glass-panel p-5 rounded-2xl text-center">
                  <Plug className="w-5 h-5 text-violet-400 mx-auto mb-2" />
                  <div className="text-2xl font-display font-bold text-white">{stats.integrationCount}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Integrations</div>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* --- API KEY STATUS --- */}
              <div className="lg:col-span-2 glass-panel p-8 rounded-2xl">
                  <div className="flex items-center justify-between mb-6">
                      <h3 className="font-display text-xl font-bold text-white">API Key Status</h3>
                  </div>
                  
                  <div className="space-y-3">
                      {[
                          { name: "Groq (3-key rotation)", status: "active", info: "GPT-OSS 120B reasoning model" },
                          { name: "Tavily", status: "active", info: "Web search integration" },
                          { name: "Gemini", status: "active", info: "Google AI model" },
                          { name: "OpenRouter", status: "active", info: "Multi-model gateway" },
                      ].map((key, i) => (
                          <div key={i} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl">
                              <div className="flex items-center gap-4">
                                  <div className="w-8 h-8 rounded-lg bg-black/50 flex items-center justify-center">
                                      <Key className="w-4 h-4 text-gray-400" />
                                  </div>
                                  <div>
                                      <div className="text-sm font-bold text-white">{key.name}</div>
                                      <div className="text-[10px] text-gray-500">{key.info}</div>
                                  </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                key.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'
                              }`}>
                                {key.status === 'active' ? '✓ Active' : 'Not Set'}
                              </span>
                          </div>
                      ))}
                      {stats.customKeyCount > 0 && (
                          <div className="flex items-center justify-between p-4 bg-cherry/5 border border-cherry/20 rounded-xl">
                              <div className="flex items-center gap-4">
                                  <div className="w-8 h-8 rounded-lg bg-black/50 flex items-center justify-center">
                                      <Key className="w-4 h-4 text-cherry" />
                                  </div>
                                  <div>
                                      <div className="text-sm font-bold text-white">Custom API Keys (BYOK)</div>
                                      <div className="text-[10px] text-gray-500">{stats.customKeyCount} agent(s) with custom keys</div>
                                  </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-cherry/20 text-cherry">
                                {stats.customKeyCount} Active
                              </span>
                          </div>
                      )}
                  </div>
              </div>

              {/* --- RECENT ACTIVITY (DYNAMIC) --- */}
              <div className="lg:col-span-1 glass-panel p-8 rounded-2xl">
                  <h3 className="font-display text-xl font-bold text-white mb-8">Activity</h3>
                  <div className="relative border-l border-white/10 pl-6 space-y-8">
                      {nodes.slice(0, 4).map((node, i) => (
                          <div key={node.id} className="relative animate-in fade-in slide-in-from-left-2" style={{ animationDelay: `${i * 100}ms`}}>
                              <div className="absolute -left-[29px] top-1.5 w-3 h-3 rounded-full bg-white/20 border-2 border-black"></div>
                              <div className="text-sm text-gray-300 font-medium">Configured "{node.data.label}"</div>
                              <div className="flex items-center gap-2 mt-1">
                                  <Clock className="w-3 h-3 text-gray-600" />
                                  <span className="text-[10px] text-gray-500 font-mono">Just now • {user.name}</span>
                              </div>
                          </div>
                      ))}
                      {nodes.length === 0 && (
                          <div className="text-xs text-gray-500 italic">No recent activity. Create a workflow to get started.</div>
                      )}
                  </div>
              </div>
          </div>

       </div>
    </div>
  );
};
