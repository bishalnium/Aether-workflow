import React, { useState, useEffect } from 'react';
import { 
  Clock, CheckCircle, XCircle, AlertTriangle, Play, 
  RefreshCw, ChevronRight, ChevronDown, Terminal, 
  ArrowLeft, Filter, Calendar, Search, Trash2,
  Pause, RotateCcw, Eye, Download, Copy, X, Zap
} from 'lucide-react';
import { View, User } from '../types';
import { storageService, Execution } from '../services/storageService';

interface NodeExecution {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  startedAt?: Date;
  completedAt?: Date;
  input?: string;
  output?: string;
  error?: string;
  duration?: number;
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  triggeredBy: 'MANUAL' | 'WEBHOOK' | 'SCHEDULE' | 'API';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  nodeExecutions: NodeExecution[];
  logs: LogEntry[];
}

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  nodeId?: string;
  metadata?: Record<string, any>;
}

interface ExecutionDashboardProps {
  onNavigate: (view: View) => void;
  user: User | null;
}

const StatusBadge: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    SUCCESS: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: <CheckCircle className="w-3 h-3" /> },
    RUNNING: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
    PENDING: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: <Clock className="w-3 h-3" /> },
    FAILED: { bg: 'bg-red-500/20', text: 'text-red-400', icon: <XCircle className="w-3 h-3" /> },
    CANCELLED: { bg: 'bg-orange-500/20', text: 'text-orange-400', icon: <Pause className="w-3 h-3" /> },
    SKIPPED: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: <AlertTriangle className="w-3 h-3" /> },
  };

  const { bg, text, icon } = config[status] || config.PENDING;
  const padding = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1';
  const textSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]';

  return (
    <span className={`inline-flex items-center gap-1 ${padding} ${bg} ${text} ${textSize} font-bold uppercase rounded tracking-wider`}>
      {icon}
      {status}
    </span>
  );
};

const TriggerBadge: React.FC<{ trigger: string }> = ({ trigger }) => {
  const config: Record<string, { bg: string; text: string }> = {
    MANUAL: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
    WEBHOOK: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
    SCHEDULE: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
    API: { bg: 'bg-pink-500/20', text: 'text-pink-400' },
  };

  const { bg, text } = config[trigger] || config.MANUAL;

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 ${bg} ${text} text-[9px] font-bold uppercase rounded tracking-wider`}>
      {trigger}
    </span>
  );
};

const formatDuration = (ms?: number): string => {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
};

const formatDate = (date: Date): string => {
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return `Today, ${formatTime(date)}`;
  if (isYesterday) return `Yesterday, ${formatTime(date)}`;
  return date.toLocaleDateString() + ', ' + formatTime(date);
};

export const ExecutionDashboard: React.FC<ExecutionDashboardProps> = ({ onNavigate, user }) => {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [triggerFilter, setTriggerFilter] = useState<string>('ALL');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'nodes' | 'logs'>('nodes');

  // Load REAL executions from storage (no more mock data)
  useEffect(() => {
    if (user?.email) {
      const loadExecutions = () => {
        const storedExecutions = storageService.getExecutions(user.email);
        const convertedExecutions: WorkflowExecution[] = storedExecutions.map(e => ({
          ...e,
          startedAt: new Date(e.startedAt),
          completedAt: e.completedAt ? new Date(e.completedAt) : undefined,
          nodeExecutions: e.nodeExecutions.map(ne => ({
            ...ne,
            startedAt: ne.startedAt ? new Date(ne.startedAt) : undefined,
            completedAt: ne.completedAt ? new Date(ne.completedAt) : undefined,
          })),
          logs: e.logs.map(l => ({
            ...l,
            timestamp: new Date(l.timestamp),
          })),
        }));
        setExecutions(convertedExecutions);
      };

      loadExecutions();
      
      // Subscribe to real-time updates
      const unsubscribe = storageService.subscribe(user.email, () => {
        loadExecutions();
      });
      
      return () => unsubscribe();
    }
  }, [user]);

  // Filter executions
  const filteredExecutions = executions.filter(exec => {
    const matchesSearch = exec.workflowName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          exec.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || exec.status === statusFilter;
    const matchesTrigger = triggerFilter === 'ALL' || exec.triggeredBy === triggerFilter;
    return matchesSearch && matchesStatus && matchesTrigger;
  });

  const handleRetry = (executionId: string) => {
    console.log('Retrying execution:', executionId);
    alert('Retry triggered for execution: ' + executionId);
  };

  const handleCancel = (executionId: string) => {
    console.log('Cancelling execution:', executionId);
    setExecutions(prev => prev.map(e => 
      e.id === executionId ? { ...e, status: 'CANCELLED' as const } : e
    ));
  };

  const toggleNodeExpansion = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Stats
  const stats = {
    total: executions.length,
    success: executions.filter(e => e.status === 'SUCCESS').length,
    failed: executions.filter(e => e.status === 'FAILED').length,
    running: executions.filter(e => e.status === 'RUNNING').length,
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden pt-20 bg-black">
      {/* Left Panel - Execution List */}
      <div className="w-96 border-r border-white/5 bg-[#050505] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <button 
              onClick={() => onNavigate('BUILDER')}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Back to Builder"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="font-display text-xl font-bold text-white">Executions</h1>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-white">{stats.total}</div>
              <div className="text-[9px] text-gray-500 uppercase">Total</div>
            </div>
            <div className="bg-emerald-500/10 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-emerald-400">{stats.success}</div>
              <div className="text-[9px] text-emerald-500/50 uppercase">Success</div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-red-400">{stats.failed}</div>
              <div className="text-[9px] text-red-500/50 uppercase">Failed</div>
            </div>
            <div className="bg-blue-500/10 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-blue-400">{stats.running}</div>
              <div className="text-[9px] text-blue-500/50 uppercase">Running</div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
              <input 
                type="text"
                placeholder="Search executions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cherry"
              />
            </div>
            <div className="flex gap-2">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 bg-black border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-cherry"
              >
                <option value="ALL">All Status</option>
                <option value="SUCCESS">Success</option>
                <option value="RUNNING">Running</option>
                <option value="FAILED">Failed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <select 
                value={triggerFilter}
                onChange={(e) => setTriggerFilter(e.target.value)}
                className="flex-1 bg-black border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-cherry"
              >
                <option value="ALL">All Triggers</option>
                <option value="MANUAL">Manual</option>
                <option value="WEBHOOK">Webhook</option>
                <option value="SCHEDULE">Schedule</option>
                <option value="API">API</option>
              </select>
            </div>
          </div>
        </div>

        {/* Execution List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredExecutions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 px-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cherry/10 to-purple-500/10 flex items-center justify-center mb-4">
                <Zap className="w-10 h-10 text-cherry/30" />
              </div>
              <p className="text-sm font-bold text-gray-400 mb-1">No Executions Yet</p>
              <p className="text-xs text-gray-600 text-center leading-relaxed">
                Run a workflow from the Builder to see real execution logs here. Each run is automatically tracked.
              </p>
              <button
                onClick={() => onNavigate('BUILDER')}
                className="mt-4 px-4 py-2 rounded-lg bg-cherry/20 text-cherry text-xs font-bold hover:bg-cherry/30 transition-colors flex items-center gap-2"
              >
                <Play className="w-3 h-3" /> Go to Builder
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredExecutions.map(exec => (
                <button
                  key={exec.id}
                  onClick={() => setSelectedExecution(exec)}
                  className={`w-full text-left p-4 hover:bg-white/5 transition-colors ${
                    selectedExecution?.id === exec.id ? 'bg-white/5 border-l-2 border-cherry' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-bold text-white truncate flex-1 mr-2">
                      {exec.workflowName}
                    </h3>
                    <StatusBadge status={exec.status} size="sm" />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <TriggerBadge trigger={exec.triggeredBy} />
                    <span>•</span>
                    <span>{formatDate(exec.startedAt)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px]">
                    <span className="text-gray-600 font-mono">{exec.id.substring(0, 20)}...</span>
                    <span className="text-gray-500">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {formatDuration(exec.duration)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Execution Details */}
      <div className="flex-1 flex flex-col bg-black/50">
        {selectedExecution ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-white/5 bg-[#0a0a0a]">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">{selectedExecution.workflowName}</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 font-mono">{selectedExecution.id}</span>
                    <StatusBadge status={selectedExecution.status} />
                    <TriggerBadge trigger={selectedExecution.triggeredBy} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedExecution.status === 'RUNNING' && (
                    <button 
                      onClick={() => handleCancel(selectedExecution.id)}
                      className="px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-orange-500/30 transition-colors"
                    >
                      <Pause className="w-3 h-3" /> Cancel
                    </button>
                  )}
                  {selectedExecution.status === 'FAILED' && (
                    <button 
                      onClick={() => handleRetry(selectedExecution.id)}
                      className="px-3 py-1.5 bg-cherry/20 text-cherry rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-cherry/30 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" /> Retry
                    </button>
                  )}
                  <button className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                    <Download className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setSelectedExecution(null)}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Timeline */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <div>
                  <span className="text-gray-600">Started:</span>{' '}
                  <span className="text-white">{formatDate(selectedExecution.startedAt)}</span>
                </div>
                {selectedExecution.completedAt && (
                  <div>
                    <span className="text-gray-600">Completed:</span>{' '}
                    <span className="text-white">{formatDate(selectedExecution.completedAt)}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-600">Duration:</span>{' '}
                  <span className="text-white font-mono">{formatDuration(selectedExecution.duration)}</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-white/5 px-6">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab('nodes')}
                  className={`py-3 text-sm font-bold border-b-2 transition-colors ${
                    activeTab === 'nodes' 
                      ? 'text-white border-cherry' 
                      : 'text-gray-500 border-transparent hover:text-gray-300'
                  }`}
                >
                  Node Executions ({selectedExecution.nodeExecutions.length})
                </button>
                <button
                  onClick={() => setActiveTab('logs')}
                  className={`py-3 text-sm font-bold border-b-2 transition-colors ${
                    activeTab === 'logs' 
                      ? 'text-white border-cherry' 
                      : 'text-gray-500 border-transparent hover:text-gray-300'
                  }`}
                >
                  Logs ({selectedExecution.logs.length})
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {activeTab === 'nodes' ? (
                <div className="space-y-3">
                  {selectedExecution.nodeExecutions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Terminal className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No node execution data available</p>
                    </div>
                  ) : (
                    selectedExecution.nodeExecutions.map((node, index) => (
                      <div 
                        key={node.id}
                        className="glass-panel rounded-xl overflow-hidden"
                      >
                        <button
                          onClick={() => toggleNodeExpansion(node.id)}
                          className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-gray-400">
                              {index + 1}
                            </div>
                            <div className="text-left">
                              <h4 className="text-sm font-bold text-white">{node.nodeName}</h4>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{node.nodeType}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 font-mono">{formatDuration(node.duration)}</span>
                            <StatusBadge status={node.status} size="sm" />
                            {expandedNodes.has(node.id) ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            )}
                          </div>
                        </button>
                        
                        {expandedNodes.has(node.id) && (
                          <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                            {node.input && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] text-gray-500 uppercase font-bold">Input</span>
                                  <button 
                                    onClick={() => copyToClipboard(node.input!)}
                                    className="text-gray-500 hover:text-white transition-colors"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                                <pre className="p-2 bg-black/40 rounded-lg text-[10px] text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap">
                                  {node.input}
                                </pre>
                              </div>
                            )}
                            {node.output && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] text-emerald-500 uppercase font-bold">Output</span>
                                  <button 
                                    onClick={() => copyToClipboard(node.output!)}
                                    className="text-gray-500 hover:text-white transition-colors"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                                <pre className="p-2 bg-emerald-500/10 rounded-lg text-[10px] text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap">
                                  {node.output}
                                </pre>
                              </div>
                            )}
                            {node.error && (
                              <div>
                                <span className="text-[10px] text-red-500 uppercase font-bold block mb-1">Error</span>
                                <pre className="p-2 bg-red-500/10 rounded-lg text-[10px] text-red-300 font-mono overflow-x-auto whitespace-pre-wrap">
                                  {node.error}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-1 font-mono text-[11px]">
                  {selectedExecution.logs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Terminal className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No logs available</p>
                    </div>
                  ) : (
                    selectedExecution.logs.map(log => (
                      <div 
                        key={log.id}
                        className={`p-2 rounded flex items-start gap-3 ${
                          log.level === 'ERROR' ? 'bg-red-500/10' : 
                          log.level === 'WARN' ? 'bg-amber-500/10' : 
                          'hover:bg-white/5'
                        }`}
                      >
                        <span className="text-gray-600 shrink-0">{formatTime(log.timestamp)}</span>
                        <span className={`shrink-0 w-12 text-center ${
                          log.level === 'ERROR' ? 'text-red-400' :
                          log.level === 'WARN' ? 'text-amber-400' :
                          log.level === 'DEBUG' ? 'text-gray-500' :
                          'text-blue-400'
                        }`}>
                          [{log.level}]
                        </span>
                        <span className="text-gray-300 flex-1">{log.message}</span>
                        {log.nodeId && (
                          <span className="text-gray-600 shrink-0">{log.nodeId}</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-white/5 to-white/0 flex items-center justify-center mb-4">
              <Eye className="w-12 h-12 opacity-20" />
            </div>
            <p className="text-lg font-bold mb-1">
              {executions.length === 0 ? 'No Executions Yet' : 'Select an Execution'}
            </p>
            <p className="text-sm text-gray-600">
              {executions.length === 0 
                ? 'Run a workflow to see execution details here' 
                : 'Click on an execution from the list to view details'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
