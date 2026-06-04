// ===========================================
// AETHER WORKFLOW ENGINE - Workflow Store
// Zustand state management for workflows
// ===========================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiService } from './apiService';

// Types
export interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  position: { x: number; y: number };
  config: Record<string, any>;
  data?: {
    label?: string;
    output?: string;
    isExecuting?: boolean;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  condition?: any;
  sourceSide?: 'left' | 'right' | 'top' | 'bottom';
  targetSide?: 'left' | 'right' | 'top' | 'bottom';
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExecutionResult {
  id: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  workflowId: string;
  startedAt?: string;
  finishedAt?: string;
  output?: any;
  error?: string;
}

interface WorkflowStore {
  // Current workflow being edited
  currentWorkflow: Workflow | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  
  // Saved workflows
  workflows: Workflow[];
  
  // Execution state
  isExecuting: boolean;
  lastExecution: ExecutionResult | null;
  executionHistory: ExecutionResult[];
  
  // AI Generator state
  isGenerating: boolean;
  generatedWorkflow: Workflow | null;
  
  // Actions
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  addNode: (node: WorkflowNode) => void;
  updateNode: (id: string, updates: Partial<WorkflowNode>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: WorkflowEdge) => void;
  removeEdge: (id: string) => void;
  
  // Workflow management
  loadWorkflow: (workflow: Workflow) => void;
  saveWorkflow: (name?: string) => Promise<Workflow | null>;
  fetchWorkflows: () => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  
  // Execution
  executeWorkflow: (input?: any) => Promise<ExecutionResult | null>;
  
  // AI Generation
  generateFromPrompt: (prompt: string) => Promise<Workflow | null>;
  applyGeneratedWorkflow: () => void;
  
  // Reset
  reset: () => void;
}

const initialNodes: WorkflowNode[] = [
  {
    id: 'start_1',
    type: 'TRIGGER_MANUAL',
    name: 'Start',
    position: { x: 100, y: 200 },
    config: {},
    data: { label: 'Start' },
  },
];

export const useWorkflowStore = create<WorkflowStore>()(
  persist(
    (set, get) => ({
      currentWorkflow: null,
      nodes: initialNodes,
      edges: [],
      workflows: [],
      isExecuting: false,
      lastExecution: null,
      executionHistory: [],
      isGenerating: false,
      generatedWorkflow: null,

      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),

      addNode: (node) => set((state) => ({
        nodes: [...state.nodes, node],
      })),

      updateNode: (id, updates) => set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === id ? { ...n, ...updates } : n
        ),
      })),

      removeNode: (id) => set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== id),
        edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      })),

      addEdge: (edge) => set((state) => ({
        edges: [...state.edges, edge],
      })),

      removeEdge: (id) => set((state) => ({
        edges: state.edges.filter((e) => e.id !== id),
      })),

      loadWorkflow: (workflow) => set({
        currentWorkflow: workflow,
        nodes: workflow.nodes,
        edges: workflow.edges,
      }),

      saveWorkflow: async (name) => {
        const { currentWorkflow, nodes, edges } = get();
        try {
          const workflowData = {
            name: name || currentWorkflow?.name || 'Untitled Workflow',
            description: currentWorkflow?.description,
            nodes,
            edges,
          };

          if (currentWorkflow?.id) {
            const result = await apiService.updateWorkflow(currentWorkflow.id, workflowData);
            if (result.success && result.data) {
              set({ currentWorkflow: result.data });
              return result.data;
            }
          } else {
            const result = await apiService.createWorkflow(workflowData);
            if (result.success && result.data) {
              set({ currentWorkflow: result.data });
              return result.data;
            }
          }
        } catch (error) {
          console.error('Failed to save workflow:', error);
        }
        return null;
      },

      fetchWorkflows: async () => {
        try {
          const result = await apiService.listWorkflows();
          if (result.success && result.data) {
            set({ workflows: result.data });
          }
        } catch (error) {
          console.error('Failed to fetch workflows:', error);
        }
      },

      deleteWorkflow: async (id) => {
        try {
          const result = await apiService.deleteWorkflow(id);
          if (result.success) {
            set((state) => ({
              workflows: state.workflows.filter((w) => w.id !== id),
              currentWorkflow:
                state.currentWorkflow?.id === id ? null : state.currentWorkflow,
            }));
          }
        } catch (error) {
          console.error('Failed to delete workflow:', error);
        }
      },

      executeWorkflow: async (input) => {
        const { currentWorkflow, nodes, edges } = get();
        set({ isExecuting: true });

        try {
          // If we have a saved workflow, use the API
          if (currentWorkflow?.id) {
            const result = await apiService.executeWorkflow(currentWorkflow.id, input);
            if (result.success && result.data) {
              const execution: ExecutionResult = {
                id: result.data.executionId,
                status: result.data.status || 'success',
                workflowId: currentWorkflow.id,
                startedAt: new Date().toISOString(),
                finishedAt: new Date().toISOString(),
                output: result.data.output,
              };
              set((state) => ({
                lastExecution: execution,
                executionHistory: [execution, ...state.executionHistory].slice(0, 50),
                isExecuting: false,
              }));
              return execution;
            }
          }

          // Fallback for local execution
          set({ isExecuting: false });
          return null;
        } catch (error) {
          console.error('Execution failed:', error);
          set({ isExecuting: false });
          return null;
        }
      },

      generateFromPrompt: async (prompt) => {
        set({ isGenerating: true });
        try {
          const result = await apiService.generateWorkflow(prompt);
          if (result.success && result.data) {
            const workflow: Workflow = {
              id: 'generated_' + Date.now(),
              name: result.data.name || 'Generated Workflow',
              description: result.data.description,
              nodes: result.data.nodes || [],
              edges: result.data.edges || [],
            };
            set({ generatedWorkflow: workflow, isGenerating: false });
            return workflow;
          }
        } catch (error) {
          console.error('Failed to generate workflow:', error);
        }
        set({ isGenerating: false });
        return null;
      },

      applyGeneratedWorkflow: () => {
        const { generatedWorkflow } = get();
        if (generatedWorkflow) {
          set({
            nodes: generatedWorkflow.nodes,
            edges: generatedWorkflow.edges,
            currentWorkflow: generatedWorkflow,
            generatedWorkflow: null,
          });
        }
      },

      reset: () => set({
        currentWorkflow: null,
        nodes: initialNodes,
        edges: [],
        isExecuting: false,
        lastExecution: null,
        generatedWorkflow: null,
      }),
    }),
    {
      name: 'aether-workflow-store',
      partialize: (state) => ({
        workflows: state.workflows,
        executionHistory: state.executionHistory.slice(0, 20),
      }),
    }
  )
);

export default useWorkflowStore;
