import fs from 'fs';

const filePath = 'components/Builder.tsx';
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Balanced Parentheses Block Range Finder
function findBlockRange(content, modelName, searchStart = 0) {
  const query = `selectedNode.data.model === '${modelName}'`;
  const idx = content.indexOf(query, searchStart);
  if (idx === -1) return null;
  
  // Find the preceding '{'
  let startBraceIdx = -1;
  for (let i = idx; i >= 0; i--) {
    if (content[i] === '{') {
      startBraceIdx = i;
      break;
    }
  }
  if (startBraceIdx === -1) return null;
  
  // Find the '(' after '&&'
  const startParenIdx = content.indexOf('(', idx);
  if (startParenIdx === -1) return null;
  
  let parenCount = 1;
  let inString = false;
  let stringChar = null;
  
  for (let i = startParenIdx + 1; i < content.length; i++) {
    const char = content[i];
    
    // Handle string literals
    if ((char === '"' || char === "'" || char === '`') && content[i-1] !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = null;
      }
    }
    
    if (!inString) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount === 0) {
        // Find the matching '}'
        const nextBrace = content.indexOf('}', i);
        if (nextBrace !== -1) {
          return {
            start: startBraceIdx,
            end: nextBrace + 1,
            modelName,
            content: content.substring(startBraceIdx, nextBrace + 1)
          };
        }
      }
    }
  }
  return null;
}

// 2. Remove duplicate github-api first block (line 4667)
const firstGithub = findBlockRange(content, 'github-api', 0);
if (firstGithub) {
  console.log(`Found first github-api block at ${firstGithub.start}-${firstGithub.end}. Removing it.`);
  content = content.substring(0, firstGithub.start) + content.substring(firstGithub.end);
}

// LLM Auto-Mapping Panel Code
const makeLlmPanel = (defaultPromptPlaceholder) => `
                                  {/* ✨ LLM Auto-Mapping Section */}
                                  <div className="pt-4 mt-4 border-t border-white/10 space-y-3">
                                    <div className="flex items-center justify-between">
                                       <div className="flex items-center gap-1.5 font-bold">
                                          <Sparkles className="w-3.5 h-3.5 text-cherry animate-pulse" />
                                          <span className="text-xs font-bold text-cream">✨ LLM Agent Auto-Format/Map</span>
                                       </div>
                                       <label className="relative inline-flex items-center cursor-pointer">
                                          <input 
                                            type="checkbox" 
                                            checked={selectedNode.data.llmAutoMap || false}
                                            onChange={(e) => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, llmAutoMap: e.target.checked } } : n))}
                                            className="sr-only peer"
                                          />
                                          <div className="w-7 h-4 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cherry peer-checked:after:bg-white"></div>
                                       </label>
                                    </div>
                                    
                                    {selectedNode.data.llmAutoMap && (
                                      <div className="space-y-3 bg-[#0d0d0d] p-3 rounded-lg border border-white/5 animate-fadeIn">
                                         <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">Mapping Instructions / Prompt</label>
                                            <textarea
                                              value={selectedNode.data.llmAutoMapPrompt || ''}
                                              onChange={(e) => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, llmAutoMapPrompt: e.target.value } } : n))}
                                              rows={3}
                                              placeholder="${defaultPromptPlaceholder}"
                                              className="w-full bg-black/50 border border-white/10 p-2 text-xs text-cream/90 focus:border-cherry focus:outline-none resize-none rounded-md"
                                            />
                                            <p className="text-[9px] text-gray-500 font-sans">Guide the LLM on how to extract and format the input context for this integration.</p>
                                         </div>

                                         <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                               <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">Provider</label>
                                               <select
                                                 value={selectedNode.data.llmAutoMapProvider || 'groq'}
                                                 onChange={(e) => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, llmAutoMapProvider: e.target.value } } : n))}
                                                 className="w-full bg-black/50 border border-white/10 p-1.5 text-[11px] text-cream focus:border-cherry focus:outline-none rounded-md"
                                               >
                                                 <option value="groq">Groq</option>
                                                 <option value="openai">OpenAI</option>
                                                 <option value="anthropic">Anthropic</option>
                                                 <option value="google">Google Gemini</option>
                                                 <option value="openrouter">OpenRouter</option>
                                               </select>
                                            </div>
                                            <div className="space-y-1">
                                               <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">Model</label>
                                               <input
                                                 type="text"
                                                 value={selectedNode.data.llmAutoMapModel || ''}
                                                 onChange={(e) => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, llmAutoMapModel: e.target.value } } : n))}
                                                 placeholder="gpt-4o-mini"
                                                 className="w-full bg-black/50 border border-white/10 p-1.5 text-[11px] text-cream focus:border-cherry focus:outline-none rounded-md font-mono"
                                               />
                                            </div>
                                         </div>

                                         <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">Custom API Key (Optional)</label>
                                            <input
                                              type="password"
                                              value={selectedNode.data.llmAutoMapApiKey || ''}
                                              onChange={(e) => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, llmAutoMapApiKey: e.target.value } } : n))}
                                              placeholder="Paste your key here (or leave empty to use server default)"
                                              className="w-full bg-black/50 border border-white/10 p-2 text-xs text-cream focus:border-cherry focus:outline-none rounded-md font-mono"
                                            />
                                         </div>
                                      </div>
                                    )}
                                  </div>`;

// RAG Synthesis Panel for Search / RSS
const ragPanel = `
                                  {/* LLM Synthesis Configuration */}
                                  <div className="pt-4 mt-4 border-t border-white/10 space-y-3">
                                    <div className="flex items-center gap-1.5 font-bold">
                                       <Sparkles className="w-3.5 h-3.5 text-cherry animate-pulse" />
                                       <span className="text-xs font-bold text-cream">AI Co-Processor / Synthesis Settings</span>
                                    </div>
                                    
                                    <div className="space-y-1">
                                       <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">System / Instruction Prompt</label>
                                       <textarea
                                         value={selectedNode.data.systemPrompt || ''}
                                         onChange={(e) => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, systemPrompt: e.target.value } } : n))}
                                         rows={3}
                                         placeholder="e.g., Validate search results and extract key statistics answering the query."
                                         className="w-full bg-black/50 border border-white/10 p-2 text-xs text-cream/90 focus:border-cherry focus:outline-none resize-none rounded-md"
                                       />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                       <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">Provider</label>
                                          <select
                                            value={selectedNode.data.llmProvider || 'groq'}
                                            onChange={(e) => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, llmProvider: e.target.value } } : n))}
                                            className="w-full bg-black/50 border border-white/10 p-1.5 text-[11px] text-cream focus:border-cherry focus:outline-none rounded-md"
                                          >
                                            <option value="groq">Groq</option>
                                            <option value="openai">OpenAI</option>
                                            <option value="anthropic">Anthropic</option>
                                            <option value="google">Google Gemini</option>
                                            <option value="openrouter">OpenRouter</option>
                                          </select>
                                       </div>
                                       <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">Model</label>
                                          <input
                                            type="text"
                                            value={selectedNode.data.llmModel || ''}
                                            onChange={(e) => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, llmModel: e.target.value } } : n))}
                                            placeholder="mixtral-8x7b-32768"
                                            className="w-full bg-black/50 border border-white/10 p-1.5 text-[11px] text-cream focus:border-gray-400 focus:outline-none rounded-md font-mono"
                                          />
                                       </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                       <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">Temperature</label>
                                          <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="1"
                                            value={selectedNode.data.llmTemperature !== undefined ? selectedNode.data.llmTemperature : 0.3}
                                            onChange={(e) => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, llmTemperature: parseFloat(e.target.value) || 0.3 } } : n))}
                                            className="w-full bg-black/50 border border-white/10 p-1.5 text-[11px] text-cream focus:border-cherry focus:outline-none rounded-md"
                                          />
                                       </div>
                                       <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">Custom API Key</label>
                                          <input
                                            type="password"
                                            value={selectedNode.data.llmApiKey || ''}
                                            onChange={(e) => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, llmApiKey: e.target.value } } : n))}
                                            placeholder="Optional key"
                                            className="w-full bg-black/50 border border-white/10 p-1.5 text-[11px] text-cream focus:border-cherry focus:outline-none rounded-md font-mono"
                                          />
                                       </div>
                                    </div>
                                  </div>`;

// Injects LLM Mapping panels and Help triggers within a block
function processBlock(modelName, type, placeholder = '', startFrom = 0) {
  const block = findBlockRange(content, modelName, startFrom);
  if (!block) {
    console.log(`Could not find block for ${modelName} starting from ${startFrom}`);
    return null;
  }
  
  let newBlockContent = block.content;
  
  // 1. Inject LLM Auto-mapping or RAG Synthesis
  if (type === 'llmAutoMap' && !newBlockContent.includes('llmAutoMap')) {
    const isDbWrite = modelName === 'db-write';
    if (isDbWrite) {
      // For db-write, wrap in fragments if not already
      const innerDivStart = newBlockContent.indexOf('<div');
      const innerDivEnd = newBlockContent.lastIndexOf('</div>');
      if (innerDivStart !== -1 && innerDivEnd !== -1) {
        const preDiv = newBlockContent.substring(0, innerDivStart);
        const innerDiv = newBlockContent.substring(innerDivStart, innerDivEnd + 6);
        const postDiv = newBlockContent.substring(innerDivEnd + 6);
        newBlockContent = `${preDiv}<>\n${innerDiv}\n${makeLlmPanel(placeholder)}\n</>${postDiv}`;
        console.log(`Wrapped and injected LLM panel into ${modelName}`);
      }
    } else {
      const lastFragIdx = newBlockContent.lastIndexOf('</>');
      if (lastFragIdx !== -1) {
        newBlockContent = newBlockContent.substring(0, lastFragIdx) + makeLlmPanel(placeholder) + '\n' + newBlockContent.substring(lastFragIdx);
        console.log(`Injected LLM panel into ${modelName}`);
      }
    }
  } else if (type === 'rag' && !newBlockContent.includes('Co-Processor')) {
    // ddg-search or rss-reader RAG panel injection
    const isDdg = modelName === 'ddg-search';
    if (isDdg) {
      // Find the closing </div> of ddg-search
      const lastDivIdx = newBlockContent.lastIndexOf('</div>');
      if (lastDivIdx !== -1) {
        newBlockContent = newBlockContent.substring(0, lastDivIdx) + ragPanel + '\n' + newBlockContent.substring(lastDivIdx);
        console.log(`Injected RAG panel into ${modelName}`);
      }
    } else {
      // rss-reader
      const lastFragIdx = newBlockContent.lastIndexOf('</>');
      if (lastFragIdx !== -1) {
        newBlockContent = newBlockContent.substring(0, lastFragIdx) + ragPanel + '\n' + newBlockContent.substring(lastFragIdx);
        console.log(`Injected RAG panel into ${modelName}`);
      }
    }
  }
  
  // 2. Inject Help Triggers inside this block
  if (modelName === 'telegram-bot') {
    newBlockContent = newBlockContent.replace(
      /Bot Token \{selectedNode\.data\.integrationToken \&\& <span className="text-green-400 normal-case ml-1">✓ Set<\/span>\}/g,
      `Bot Token {selectedNode.data.integrationToken && <span className="text-green-400 normal-case ml-1">✓ Set</span>}`
    ).replace(
      /<label className="text-\[10px\] font-bold text-cream\/50 uppercase tracking-wider">\s*Bot Token \{selectedNode\.data\.integrationToken \&\& <span className="text-green-400 normal-case ml-1">✓ Set<\/span>\}\s*<\/label>/g,
      `<div className="flex items-center justify-between">
                                       <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">
                                          Bot Token {selectedNode.data.integrationToken && <span className="text-green-400 normal-case ml-1">✓ Set</span>}
                                       </label>
                                       <button 
                                         type="button"
                                         onClick={() => setShowHelpFor('telegram-bot')}
                                         className="text-[9px] text-sky-400 hover:text-sky-300 font-bold transition-colors"
                                       >
                                         ❓ Get Token / Help
                                       </button>
                                     </div>`
    );
  } else if (modelName === 'notion') {
    newBlockContent = newBlockContent.replace(
      /<label className="text-\[10px\] font-bold text-cream\/50 uppercase tracking-wider">\s*Notion Token \{selectedNode\.data\.integrationToken \&\& <span className="text-green-400 normal-case ml-1">✓ Set<\/span>\}\s*<\/label>/g,
      `<div className="flex items-center justify-between">
                                       <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">
                                          Notion Token {selectedNode.data.integrationToken && <span className="text-green-400 normal-case ml-1">✓ Set</span>}
                                       </label>
                                       <button 
                                         type="button"
                                         onClick={() => setShowHelpFor('notion')}
                                         className="text-[9px] text-sky-400 hover:text-sky-300 font-bold transition-colors"
                                       >
                                         ❓ Get Token / Help
                                       </button>
                                     </div>`
    );
  } else if (modelName === 'discord') {
    newBlockContent = newBlockContent.replace(
      /<label className="text-\[10px\] font-bold text-cream\/50 uppercase tracking-wider">Webhook URL<\/label>/g,
      `<div className="flex items-center justify-between">
                                       <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">Webhook URL</label>
                                       <button 
                                         type="button"
                                         onClick={() => setShowHelpFor('discord')}
                                         className="text-[9px] text-sky-400 hover:text-sky-300 font-bold transition-colors"
                                       >
                                         ❓ Get Token / Help
                                       </button>
                                     </div>`
    );
  } else if (modelName === 'google-sheets') {
    newBlockContent = newBlockContent.replace(
      /<label className="text-\[10px\] font-bold text-cream\/50 uppercase tracking-wider">Service Account JSON<\/label>/g,
      `<div className="flex items-center justify-between">
                                       <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">Service Account JSON</label>
                                       <button 
                                         type="button"
                                         onClick={() => setShowHelpFor('google-sheets')}
                                         className="text-[9px] text-sky-400 hover:text-sky-300 font-bold transition-colors"
                                       >
                                         ❓ Get Token / Help
                                       </button>
                                     </div>`
    );
  } else if (modelName === 'github-api') {
    newBlockContent = newBlockContent.replace(
      /<label className="text-\[10px\] font-bold text-cream\/50 uppercase tracking-wider">\s*GitHub Token \{selectedNode\.data\.integrationToken \&\& <span className="text-emerald-400">✓<\/span>\}\s*<\/label>/g,
      `<div className="flex items-center justify-between">
                                       <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">
                                          GitHub Token {selectedNode.data.integrationToken && <span className="text-emerald-400">✓</span>}
                                       </label>
                                       <button 
                                         type="button"
                                         onClick={() => setShowHelpFor('github-api')}
                                         className="text-[9px] text-sky-400 hover:text-sky-300 font-bold transition-colors"
                                       >
                                         ❓ Get Token / Help
                                       </button>
                                     </div>`
    );
  } else if (modelName === 'firebase') {
    newBlockContent = newBlockContent.replace(
      /<label className="text-\[10px\] font-bold text-cream\/50 uppercase tracking-wider">Service Account JSON<\/label>/g,
      `<div className="flex items-center justify-between">
                                       <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">Service Account JSON</label>
                                       <button 
                                         type="button"
                                         onClick={() => setShowHelpFor('firebase')}
                                         className="text-[9px] text-sky-400 hover:text-sky-300 font-bold transition-colors"
                                       >
                                         ❓ Get Token / Help
                                       </button>
                                     </div>`
    );
  }
  
  // Replace the original block content in the file content
  const startIdx = content.indexOf(block.content);
  if (startIdx !== -1) {
    content = content.substring(0, startIdx) + newBlockContent + content.substring(startIdx + block.content.length);
    console.log(`Processed block for ${modelName} successfully.`);
    return startIdx + newBlockContent.length;
  }
  return null;
}

// Enhance all blocks in order, keeping track of indices
let currentPos = 0;

// 1. db-write first block
currentPos = processBlock('db-write', 'llmAutoMap', 'e.g., Output a JSON object matching database columns.', 0) || 0;

// 2. ddg-search first block
processBlock('ddg-search', 'rag', '', 0);

// 3. rss-reader first block
processBlock('rss-reader', 'rag', '', 0);

// 4. db-write second block (starts after currentPos)
processBlock('db-write', 'llmAutoMap', 'e.g., Output a JSON object matching database columns.', currentPos);

// 5. ddg-search second block
let ddgPos = content.indexOf("selectedNode.data.model === 'ddg-search'");
ddgPos = content.indexOf("selectedNode.data.model === 'ddg-search'", ddgPos + 1);
processBlock('ddg-search', 'rag', '', ddgPos);

// 6. rss-reader second block
let rssPos = content.indexOf("selectedNode.data.model === 'rss-reader'");
rssPos = content.indexOf("selectedNode.data.model === 'rss-reader'", rssPos + 1);
processBlock('rss-reader', 'rag', '', rssPos);

// 7. telegram-bot
processBlock('telegram-bot', 'llmAutoMap', 'e.g., Format the text notification. Output a plain-text message.', 0);

// 8. notion
processBlock('notion', 'llmAutoMap', 'e.g., Extract properties matching the database schema.', 0);

// 9. discord
processBlock('discord', 'llmAutoMap', 'e.g., Format the message context into a clean Discord alert.', 0);

// 10. google-sheets
processBlock('google-sheets', 'llmAutoMap', 'e.g., Map fields from input context to rowData format (JSON array).', 0);

// 11. github-api (the classic remaining one)
processBlock('github-api', 'llmAutoMap', 'e.g., Output a JSON object containing {"title": "...", "body": "..."} to create a GitHub issue.', 0);

// 12. firebase
processBlock('firebase', 'llmAutoMap', 'e.g., Format JSON data matching your Firestore document fields.', 0);

// Save the content back to Builder.tsx
fs.writeFileSync(filePath, content.replace(/\n/g, '\r\n'), 'utf8');
console.log('Successfully completed character-balanced injections in Builder.tsx');
