import fs from 'fs';

const filePath = 'components/Builder.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Helper to replace text
function replaceExactly(target, replacement) {
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const normalizedTarget = target.replace(/\r\n/g, '\n');
  const normalizedReplacement = replacement.replace(/\r\n/g, '\n');
  
  const pos = normalizedContent.indexOf(normalizedTarget);
  if (pos === -1) {
    console.error(`ERROR: Target not found! Target preview:\n${target.substring(0, 150)}`);
    return false;
  }
  const secondPos = normalizedContent.indexOf(normalizedTarget, pos + 1);
  if (secondPos !== -1) {
    console.warn(`WARNING: Multiple matches found for target!`);
  }
  
  content = normalizedContent.replace(normalizedTarget, normalizedReplacement).replace(/\n/g, '\r\n');
  console.log(`Successfully replaced target.`);
  return true;
}

// 1. Help Modal Component Definition
const helpModalCode = `
// --- HELP MODAL CONTENT & COMPONENT ---
interface IntegrationHelpModalProps {
  type: string;
  onClose: () => void;
}

const HELP_CONTENT: Record<string, { title: string; steps: string[] }> = {
  'telegram-bot': {
    title: 'Telegram Bot Token Setup Guide',
    steps: [
      'Open Telegram and search for @BotFather.',
      'Send /newbot and follow the instructions to set your bot name and username.',
      'Copy the HTTP API token provided by BotFather.',
      'Paste the token into the Bot Token field in the configuration panel.'
    ]
  },
  'notion': {
    title: 'Notion Integration Guide',
    steps: [
      'Go to Notion My Integrations page (notion.so/my-integrations).',
      'Click "+ New integration", select workspace, name it, and save.',
      'Go to the Secrets tab and copy the "Internal Integration Secret".',
      'Open the Notion page/database you want to connect.',
      'Click the "..." (top right) -> "Add connections" -> search and select your integration.'
    ]
  },
  'discord': {
    title: 'Discord Webhook Guide',
    steps: [
      'Open Discord server settings.',
      'Go to Integrations -> Webhooks.',
      'Click "Create Webhook" and select a channel.',
      'Click "Copy Webhook URL" and paste it in the webhook input.'
    ]
  },
  'google-sheets': {
    title: 'Google Sheets & Service Account Setup Guide',
    steps: [
      'Go to Google Cloud Console (console.cloud.google.com).',
      'Enable Google Sheets and Google Drive APIs in your project.',
      'Create a Service Account under Credentials -> Create Credentials.',
      'Go to Keys tab on your Service Account page -> Add Key -> Create new key (JSON).',
      'Paste the generated JSON key contents into the Google Service Account Credentials field.',
      'Copy the service account email and share your Spreadsheet with it as an Editor.'
    ]
  },
  'github-api': {
    title: 'GitHub Access Token Guide',
    steps: [
      'Go to GitHub -> Settings -> Developer settings.',
      'Select Personal access tokens -> Tokens (classic).',
      'Click "Generate new token" (classic).',
      'Select the "repo" scope (and "workflow" if managing actions).',
      'Generate, copy the token, and paste it in the Token field.'
    ]
  },
  'firebase': {
    title: 'Firebase Admin Credentials Guide',
    steps: [
      'Go to Firebase Console (console.firebase.google.com).',
      'Select your project -> Project Settings -> Service accounts.',
      'Click "Generate new private key" under Firebase Admin SDK.',
      'Open the downloaded JSON file, copy its contents, and paste into the Credentials field.'
    ]
  }
};

const IntegrationHelpModal: React.FC<IntegrationHelpModalProps> = ({ type, onClose }) => {
  const content = HELP_CONTENT[type];
  if (!content) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[99999] p-4">
      <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-white/10 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <h3 className="text-base font-bold text-cream mb-4">{content.title}</h3>
        <div className="space-y-3">
          {content.steps.map((step, idx) => (
            <div key={idx} className="flex gap-3 text-xs leading-relaxed text-cream/80">
              <span className="w-5 h-5 rounded-full bg-cherry/20 text-cherry flex items-center justify-center font-bold text-[10px] shrink-0">{idx + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-cherry text-cream font-bold text-xs hover:bg-cherry-hover transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
`;

console.log('Inserting IntegrationHelpModal component...');
replaceExactly(`export const Builder: React.FC<BuilderProps>`, `${helpModalCode}\nexport const Builder: React.FC<BuilderProps>`);

// 2. Insert connectingSide and showHelpFor states
const oldStates = `  // --- STATE ---
  // Nodes and Edges are now received via props for persistence
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);`;

const newStates = `  // --- STATE ---
  // Nodes and Edges are now received via props for persistence
  const [connectingSide, setConnectingSide] = useState<'left' | 'right' | 'top' | 'bottom'>('right');
  const [showHelpFor, setShowHelpFor] = useState<string | null>(null);
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);`;

console.log('Inserting state hooks...');
replaceExactly(oldStates, newStates);

// 3. Render Help Modal next to settings modal
const oldSettingsModal = `      {/* --- SETTINGS MODAL --- */}
      {showSettings && (`;

const newSettingsModal = `      {/* --- INTEGRATION HELP MODAL --- */}
      {showHelpFor && (
        <IntegrationHelpModal 
          type={showHelpFor} 
          onClose={() => setShowHelpFor(null)} 
        />
      )}

      {/* --- SETTINGS MODAL --- */}
      {showSettings && (`;

console.log('Rendering IntegrationHelpModal triggers...');
replaceExactly(oldSettingsModal, newSettingsModal);

// 4. Inject S-curves and svg markup
const oldSvg = `            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
              {edges.map(edge => {
                const source = nodes.find(n => n.id === edge.source);
                const target = nodes.find(n => n.id === edge.target);
                if (!source || !target) return null;
                
                // Calculate Y position based on endpoint index
                const sourceOutputCount = source.data.outputEndpoints || 1;
                const targetInputCount = target.data.inputEndpoints || 1;
                const sourceEndpointIdx = edge.sourceEndpoint || 0;
                const targetEndpointIdx = edge.targetEndpoint || 0;
                
                const sourceYOffset = sourceOutputCount === 1 
                  ? NODE_HEIGHT / 2 
                  : NODE_HEIGHT * (0.2 + (0.6 / sourceOutputCount) * (sourceEndpointIdx + 0.5));
                const targetYOffset = targetInputCount === 1 
                  ? NODE_HEIGHT / 2 
                  : NODE_HEIGHT * (0.2 + (0.6 / targetInputCount) * (targetEndpointIdx + 0.5));
                
                const sourcePos = { x: source.position.x + NODE_WIDTH, y: source.position.y + sourceYOffset };
                const targetPos = { x: target.position.x, y: target.position.y + targetYOffset };
                return (
                    <g key={edge.id}>
                        <path d={getEdgePath(sourcePos, targetPos)} stroke="#333" strokeWidth="4" fill="none" />
                        <path d={getEdgePath(sourcePos, targetPos)} stroke={selectedNodeId === edge.source ? "#D90429" : "#666"} strokeWidth="1.5" fill="none" className="transition-colors duration-300" />
                    </g>
                );
              })}
              
              {connectingNodeId && (() => {
                const connectingNode = nodes.find(n => n.id === connectingNodeId);
                if (!connectingNode) return null;
                const outputCount = connectingNode.data.outputEndpoints || 1;
                const yOffset = outputCount === 1 
                  ? NODE_HEIGHT / 2 
                  : NODE_HEIGHT * (0.2 + (0.6 / outputCount) * (connectingEndpoint + 0.5));
                return (
                  <path 
                    d={getEdgePath(
                        { 
                            x: connectingNode.position.x + NODE_WIDTH, 
                            y: connectingNode.position.y + yOffset 
                        }, 
                        mousePos
                    )} 
                    stroke="#D90429" 
                    strokeWidth="2" 
                    strokeDasharray="5,5" 
                    fill="none" 
                  />
                );
              })()}
            </svg>`;

const newSvg = `            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 2 L 8 5 L 0 8 z" fill="#666" />
                </marker>
                <marker id="arrow-selected" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 2 L 8 5 L 0 8 z" fill="#D90429" />
                </marker>
              </defs>
              {edges.map(edge => {
                const source = nodes.find(n => n.id === edge.source);
                const target = nodes.find(n => n.id === edge.target);
                if (!source || !target) return null;
                
                const sourceSide = edge.sourceSide || 'right';
                const targetSide = edge.targetSide || 'left';
                
                const sourceOutputCount = source.data.outputEndpoints || 1;
                const targetInputCount = target.data.inputEndpoints || 1;
                const sourceEndpointIdx = edge.sourceEndpoint || 0;
                const targetEndpointIdx = edge.targetEndpoint || 0;
                
                const sourceYOffset = sourceOutputCount === 1 
                  ? NODE_HEIGHT / 2 
                  : NODE_HEIGHT * (0.2 + (0.6 / sourceOutputCount) * (sourceEndpointIdx + 0.5));
                const sourceXOffset = sourceOutputCount === 1
                  ? NODE_WIDTH / 2
                  : NODE_WIDTH * (0.2 + (0.6 / sourceOutputCount) * (sourceEndpointIdx + 0.5));
                
                const targetYOffset = targetInputCount === 1 
                  ? NODE_HEIGHT / 2 
                  : NODE_HEIGHT * (0.2 + (0.6 / targetInputCount) * (targetEndpointIdx + 0.5));
                const targetXOffset = targetInputCount === 1
                  ? NODE_WIDTH / 2
                  : NODE_WIDTH * (0.2 + (0.6 / targetInputCount) * (targetEndpointIdx + 0.5));
                
                let sourcePos = { x: source.position.x + NODE_WIDTH, y: source.position.y + sourceYOffset };
                if (sourceSide === 'left') {
                  sourcePos = { x: source.position.x, y: source.position.y + sourceYOffset };
                } else if (sourceSide === 'top') {
                  sourcePos = { x: source.position.x + sourceXOffset, y: source.position.y };
                } else if (sourceSide === 'bottom') {
                  sourcePos = { x: source.position.x + sourceXOffset, y: source.position.y + NODE_HEIGHT };
                }
                
                let targetPos = { x: target.position.x, y: target.position.y + targetYOffset };
                if (targetSide === 'right') {
                  targetPos = { x: target.position.x + NODE_WIDTH, y: target.position.y + targetYOffset };
                } else if (targetSide === 'top') {
                  targetPos = { x: target.position.x + targetXOffset, y: target.position.y };
                } else if (targetSide === 'bottom') {
                  targetPos = { x: target.position.x + targetXOffset, y: target.position.y + NODE_HEIGHT };
                }
                
                return (
                    <g key={edge.id}>
                        <path d={getEdgePath(sourcePos, targetPos, sourceSide, targetSide)} stroke="#333" strokeWidth="4" fill="none" />
                        <path 
                          d={getEdgePath(sourcePos, targetPos, sourceSide, targetSide)} 
                          stroke={selectedNodeId === edge.source ? "#D90429" : "#666"} 
                          strokeWidth="1.5" 
                          fill="none" 
                          className="transition-colors duration-300"
                          markerEnd={selectedNodeId === edge.source ? "url(#arrow-selected)" : "url(#arrow)"}
                        />
                    </g>
                );
              })}
              
              {connectingNodeId && (() => {
                const connectingNode = nodes.find(n => n.id === connectingNodeId);
                if (!connectingNode) return null;
                const outputCount = connectingNode.data.outputEndpoints || 1;
                
                const sourceYOffset = outputCount === 1 
                  ? NODE_HEIGHT / 2 
                  : NODE_HEIGHT * (0.2 + (0.6 / outputCount) * (connectingEndpoint + 0.5));
                const sourceXOffset = outputCount === 1
                  ? NODE_WIDTH / 2
                  : NODE_WIDTH * (0.2 + (0.6 / outputCount) * (connectingEndpoint + 0.5));
                
                let startPos = { x: connectingNode.position.x + NODE_WIDTH, y: connectingNode.position.y + sourceYOffset };
                if (connectingSide === 'left') {
                  startPos = { x: connectingNode.position.x, y: connectingNode.position.y + sourceYOffset };
                } else if (connectingSide === 'top') {
                  startPos = { x: connectingNode.position.x + sourceXOffset, y: connectingNode.position.y };
                } else if (connectingSide === 'bottom') {
                  startPos = { x: connectingNode.position.x + sourceXOffset, y: connectingNode.position.y + NODE_HEIGHT };
                }
                
                return (
                  <path 
                    d={getEdgePath(startPos, mousePos, connectingSide, 'left')} 
                    stroke="#D90429" 
                    strokeWidth="2" 
                    strokeDasharray="5,5" 
                    fill="none" 
                  />
                );
              })()}
            </svg>`;

console.log('Replacing SVG edge rendering container...');
replaceExactly(oldSvg, newSvg);

// Save current modifications
fs.writeFileSync(filePath, content, 'utf8');
console.log('Reconstruction phase 1 complete!');
