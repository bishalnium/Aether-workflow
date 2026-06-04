// EmailJS global type declaration
declare global {
  interface Window {
    emailjs: {
      init: (options: { publicKey: string }) => void;
      send: (serviceId: string, templateId: string, params: Record<string, string>) => Promise<{ status: number; text: string }>;
    };
  }
}

export interface Position {
  x: number;
  y: number;
}

export enum NodeType {
  TRIGGER = 'TRIGGER',
  AGENT = 'AGENT',
  CONDITION = 'CONDITION',
  OUTPUT = 'OUTPUT',
  WEBHOOK = 'WEBHOOK',
  DATABASE = 'DATABASE',
  SLACK = 'SLACK',
  EMAIL = 'EMAIL',
  PARSER = 'PARSER',
  // New automation node types
  HTTP_REQUEST = 'HTTP_REQUEST',
  CODE = 'CODE',
  SWITCH = 'SWITCH',
  LOOP = 'LOOP',
  WAIT = 'WAIT',
  FILTER = 'FILTER',
  MERGE = 'MERGE',
  SET = 'SET',
  AI_CHAT = 'AI_CHAT',
  AI_SUMMARIZE = 'AI_SUMMARIZE',
  SCHEDULE = 'SCHEDULE',
  FORM = 'FORM',
  // Webhook & API node types
  TRIGGER_WEBHOOK = 'TRIGGER_WEBHOOK',
  ACTION_RESPOND = 'ACTION_RESPOND',
}

export interface Attachment {
  name: string;
  type: string;
  size?: string;
  content?: string;
}

export interface NodeData {
  label: string;
  category?: string; // Added for agent categorization
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  output?: string; // The result of the execution
  isExecuting?: boolean;
  attachments?: Attachment[];
  // Custom API key for AI models
  customApiKey?: string;
  apiProvider?: 'openrouter' | 'openai' | 'anthropic' | 'google' | 'custom';
  // Integrations specific data
  recipient?: string;
  subject?: string;
  // Email sender - Gmail OAuth
  senderEmail?: string;
  credentialId?: string;
  emailTemplate?: string;
  // Webhook & API specific data
  webhookPath?: string;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  responseMode?: 'onReceived' | 'onCompleted';
  statusCode?: number;
  contentType?: string;
  responseBody?: string;
  headers?: Record<string, string>;
  // HTTP Request node
  url?: string;
  queryParams?: Record<string, string>;
  bodyType?: 'json' | 'form' | 'raw';
  body?: string;
  // Flow control specific data
  duration?: number;
  durationUnit?: 'seconds' | 'minutes' | 'hours';
  condition?: string;
  filterExpr?: string;
  batchSize?: number;
  // Transform/Set node
  transformCode?: string;
  setValues?: Record<string, any>;
  // Split/Merge
  splitField?: string;
  mergeMode?: 'combine' | 'wait';
  // Generated file download
  downloadUrl?: string;
  // Node color for customization
  color?: string;
  // Multiple endpoints support
  inputEndpoints?: number;  // Number of input endpoints (default 1)
  outputEndpoints?: number; // Number of output endpoints (default 1)
  formatWithAI?: boolean;   // Enable AI formatting for output (e.g. Email Sender)
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: Position;
  data: NodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceEndpoint?: number; // Which output endpoint (0-indexed)
  targetEndpoint?: number; // Which input endpoint (0-indexed)
  sourceSide?: 'left' | 'right' | 'top' | 'bottom';
  targetSide?: 'left' | 'right' | 'top' | 'bottom';
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'success' | 'error' | 'warning';
  message: string;
  nodeId?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  token?: string;
  joinedAt?: string; // Added for profile history
}

export type View = 
  | 'LANDING' 
  | 'AUTH' 
  | 'BUILDER' 
  | 'DEPLOYMENTS'
  | 'PROFILE'
  | 'ARCHITECTURE'
  | 'EXECUTIONS'
  // Platform Pages
  | 'PLATFORM_OBSERVABILITY' 
  | 'PLATFORM_EVALUATIONS' 
  | 'PLATFORM_PROMPT_CHAIN' 
  | 'PLATFORM_CHANGELOG'
  // Resources Pages
  | 'RESOURCES_DOCS' 
  | 'RESOURCES_API' 
  | 'RESOURCES_COMMUNITY' 
  | 'RESOURCES_HELP'
  // Company Pages
  | 'COMPANY_ABOUT' 
  | 'COMPANY_ENTERPRISE' 
  | 'COMPANY_CAREERS' 
  | 'COMPANY_LEGAL';
