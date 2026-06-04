// ===========================================
// AETHER WORKFLOW ENGINE - Core Types
// ===========================================

// Node Configuration Types
export interface Position {
  x: number;
  y: number;
}

export interface WorkflowNodeConfig {
  // Common
  name?: string;
  
  // HTTP Request
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  
  // Email
  to?: string | string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  htmlBody?: string;
  textBody?: string;
  
  // Code Node
  code?: string;
  language?: 'javascript' | 'python';
  
  // Database
  operation?: 'select' | 'insert' | 'update' | 'delete';
  table?: string;
  query?: string;
  values?: any;
  
  // AI Node
  model?: string;
  prompt?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  
  // Schedule
  cronExpression?: string;
  timezone?: string;
  
  // Webhook
  path?: string;
  httpMethod?: string;
  authentication?: 'none' | 'basic' | 'header' | 'jwt';
  
  // Slack/Discord
  channel?: string;
  message?: string;
  
  // Set/Transform
  fields?: Record<string, any>;
  expression?: string;
  
  // Condition/Switch
  conditions?: Array<{
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'regex';
    value: any;
    output?: number;
  }>;
  
  // Loop
  itemsPath?: string;
  batchSize?: number;
  
  // Wait
  duration?: number;
  unit?: 'seconds' | 'minutes' | 'hours' | 'days';
  
  // Credential reference
  credentialId?: string;
  
  // Any extra config
  [key: string]: any;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  position: Position;
  config: WorkflowNodeConfig;
  credentialId?: string;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  condition?: {
    field: string;
    operator: string;
    value: any;
  };
  sourceSide?: 'left' | 'right' | 'top' | 'bottom';
  targetSide?: 'left' | 'right' | 'top' | 'bottom';
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  settings?: {
    errorHandling?: 'stop' | 'continue' | 'retry';
    maxRetries?: number;
    timeout?: number;
  };
}

// Node Types Enum
export enum NodeType {
  // Frontend compatibility types
  AGENT = 'AGENT',
  TRIGGER = 'TRIGGER',
  CONDITION = 'CONDITION',
  OUTPUT = 'OUTPUT',
  
  // Triggers
  TRIGGER_WEBHOOK = 'TRIGGER_WEBHOOK',
  TRIGGER_SCHEDULE = 'TRIGGER_SCHEDULE',
  TRIGGER_FORM = 'TRIGGER_FORM',
  TRIGGER_EVENT = 'TRIGGER_EVENT',
  TRIGGER_MANUAL = 'TRIGGER_MANUAL',
  
  // Core Actions
  ACTION_HTTP = 'ACTION_HTTP',
  ACTION_CODE = 'ACTION_CODE',
  ACTION_SET = 'ACTION_SET',
  ACTION_MERGE = 'ACTION_MERGE',
  ACTION_SPLIT = 'ACTION_SPLIT',
  ACTION_FILTER = 'ACTION_FILTER',
  ACTION_SWITCH = 'ACTION_SWITCH',
  ACTION_LOOP = 'ACTION_LOOP',
  ACTION_WAIT = 'ACTION_WAIT',
  ACTION_RESPOND = 'ACTION_RESPOND',
  
  // Integrations
  ACTION_EMAIL = 'ACTION_EMAIL',
  ACTION_SLACK = 'ACTION_SLACK',
  ACTION_DISCORD = 'ACTION_DISCORD',
  ACTION_TELEGRAM = 'ACTION_TELEGRAM',
  ACTION_GOOGLE_SHEETS = 'ACTION_GOOGLE_SHEETS',
  ACTION_DATABASE = 'ACTION_DATABASE',
  ACTION_S3 = 'ACTION_S3',
  
  // AI Actions
  ACTION_AI_CHAT = 'ACTION_AI_CHAT',
  ACTION_AI_SUMMARIZE = 'ACTION_AI_SUMMARIZE',
  ACTION_AI_CLASSIFY = 'ACTION_AI_CLASSIFY',
  ACTION_AI_TRANSFORM = 'ACTION_AI_TRANSFORM',
  
  // Utilities
  ACTION_FUNCTION = 'ACTION_FUNCTION',
  ACTION_ERROR_TRIGGER = 'ACTION_ERROR_TRIGGER',
  ACTION_SUBWORKFLOW = 'ACTION_SUBWORKFLOW',
}

// Execution Types
export interface ExecutionContext {
  executionId: string;
  workflowId: string;
  userId?: string;
  mode: 'manual' | 'webhook' | 'schedule' | 'retry' | 'subworkflow';
  startedAt: Date;
  input?: any;
  nodeOutputs: Map<string, any>;
  variables: Record<string, any>;
  credentials: Map<string, any>;
}

export interface NodeExecutionResult {
  nodeId: string;
  status: 'success' | 'error' | 'skipped';
  data?: any;
  error?: string;
  startedAt: Date;
  finishedAt: Date;
  logs?: string[];
}

export type NodeHandler = (
  node: WorkflowNode,
  input: any,
  context: ExecutionContext
) => Promise<any>;

// Credential Types
export interface CredentialData {
  id: string;
  name: string;
  type: CredentialType;
  data: Record<string, any>;
}

export enum CredentialType {
  API_KEY = 'API_KEY',
  OAUTH2 = 'OAUTH2',
  BASIC_AUTH = 'BASIC_AUTH',
  SMTP = 'SMTP',
  DATABASE = 'DATABASE',
  AWS = 'AWS',
  GOOGLE = 'GOOGLE',
  SLACK = 'SLACK',
  CUSTOM = 'CUSTOM',
}

// Job Queue Types
export interface JobPayload {
  workflowId: string;
  executionId: string;
  input?: any;
  userId?: string;
  mode: 'manual' | 'webhook' | 'schedule' | 'retry';
}

// Webhook Types
export interface WebhookPayload {
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: any;
  timestamp: Date;
}

// Log Types
export interface ExecutionLog {
  id: string;
  executionId: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  nodeId?: string;
  data?: any;
  timestamp: Date;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    timestamp: string;
    executionId?: string;
  };
}
