import fs from 'fs';

const filePath = 'components/Builder.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to LF for parsing
content = content.replace(/\r\n/g, '\n');

// 1. LLM Auto-Mapping panel generator
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
                                                 className="w-full bg-black/50 border border-white/10 p-1.5 text-[11px] text-cream focus:border-gray-400 focus:outline-none rounded-md font-mono"
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

// Insert the LLM mappings to all occurrences of models
const modelsToEnhance = [
  { model: 'telegram-bot', placeholder: 'e.g., Format the text notification. Output a plain-text message.', type: 'llmAutoMap', closeTag: '</>\n                              )}' },
  { model: 'notion', placeholder: 'e.g., Extract properties matching the database schema.', type: 'llmAutoMap', closeTag: '</>\n                              )}' },
  { model: 'discord', placeholder: 'e.g., Format the message context into a clean Discord alert.', type: 'llmAutoMap', closeTag: '</>\n                              )}' },
  { model: 'google-sheets', placeholder: 'e.g., Map fields from input context to rowData format (JSON array).', type: 'llmAutoMap', closeTag: '</>\n                               )}' },
  { model: 'firebase', placeholder: 'e.g., Format JSON data matching your Firestore document fields.', type: 'llmAutoMap', closeTag: '</>\n                               )}' },
  
  // Both occurrences of github-api
  { model: 'github-api', placeholder: 'e.g., Output a JSON object containing {"title": "...", "body": "..."} to create a GitHub issue.', type: 'llmAutoMap', closeTag: '</>\n                              )}', all: true },
  
  // Both occurrences of db-write
  { model: 'db-write', placeholder: 'e.g., Output a JSON object matching database columns.', type: 'llmAutoMap', closeTag: '</div>\n                              )}', all: true },
  
  // Search and RSS RAG Configuration
  { model: 'ddg-search', type: 'rag', closeTag: '</div>\n                              )}', all: true },
  { model: 'rss-reader', type: 'rag', closeTag: '</>\n                              )}', all: true }
];

modelsToEnhance.forEach(spec => {
  const query = `selectedNode.data.model === '${spec.model}'`;
  let idx = -1;
  
  while ((idx = content.indexOf(query, idx + 1)) !== -1) {
    // Find the next occurrence of closeTag after idx
    const closePos = content.indexOf(spec.closeTag, idx);
    if (closePos === -1) {
      console.error(`Could not find closing tag for ${spec.model} at index ${idx}`);
      continue;
    }
    
    // Check if the LLM panel is already there
    const blockContent = content.substring(idx, closePos);
    if (blockContent.includes('✨ LLM Agent Auto-Format/Map') || blockContent.includes('AI Co-Processor')) {
      console.log(`Model ${spec.model} at ${idx} already has LLM configurations. Skipping.`);
      if (!spec.all) break;
      continue;
    }
    
    const panelCode = spec.type === 'llmAutoMap' ? makeLlmPanel(spec.placeholder) : ragPanel;
    
    // Inject the panel code right before the closing fragment
    content = content.substring(0, closePos) + panelCode + '\n' + content.substring(closePos);
    console.log(`Successfully injected LLM panel into ${spec.model} at position ${idx}`);
    
    if (!spec.all) break; // If not "all", only modify the first occurrence
  }
});

// 2. Add Help Trigger buttons
const helpTriggers = [
  {
    target: `<label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">\n                                        Bot Token {selectedNode.data.integrationToken && <span className="text-green-400 normal-case ml-1">✓ Set</span>}\n                                     </label>`,
    replacement: `<div className="flex items-center justify-between">\n                                       <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">\n                                          Bot Token {selectedNode.data.integrationToken && <span className="text-green-400 normal-case ml-1">✓ Set</span>}\n                                       </label>\n                                       <button \n                                         onClick={() => setShowHelpFor('telegram-bot')}\n                                         className="text-[9px] text-sky-400 hover:text-sky-300 font-bold transition-colors"\n                                       >\n                                         ❓ Get Token / Help\n                                       </button>\n                                     </div>`
  },
  {
    target: `<label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">\n                                        Notion Token {selectedNode.data.integrationToken && <span className="text-green-400 normal-case ml-1">✓ Set</span>}\n                                     </label>`,
    replacement: `<div className="flex items-center justify-between">\n                                       <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">\n                                          Notion Token {selectedNode.data.integrationToken && <span className="text-green-400 normal-case ml-1">✓ Set</span>}\n                                       </label>\n                                       <button \n                                         onClick={() => setShowHelpFor('notion')}\n                                         className="text-[9px] text-sky-400 hover:text-sky-300 font-bold transition-colors"\n                                       >\n                                         ❓ Get Token / Help\n                                       </button>\n                                     </div>`
  },
  {
    target: `<label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">Webhook URL</label>`,
    replacement: `<div className="flex items-center justify-between">\n                                       <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">Webhook URL</label>\n                                       <button \n                                         onClick={() => setShowHelpFor('discord')}\n                                         className="text-[9px] text-sky-400 hover:text-sky-300 font-bold transition-colors"\n                                       >\n                                         ❓ Get Token / Help\n                                       </button>\n                                     </div>`
  },
  {
    target: `<label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">Service Account JSON</label>\n                                      <textarea \n                                        value={selectedNode.data.sheetsServiceAccountJson || ''}`,
    replacement: `<div className="flex items-center justify-between">\n                                       <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">Service Account JSON</label>\n                                       <button \n                                         onClick={() => setShowHelpFor('google-sheets')}\n                                         className="text-[9px] text-sky-400 hover:text-sky-300 font-bold transition-colors"\n                                       >\n                                         ❓ Get Token / Help\n                                       </button>\n                                     </div>\n                                      <textarea \n                                        value={selectedNode.data.sheetsServiceAccountJson || ''}`
  },
  {
    target: `<label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">Service Account JSON</label>\n                                      <textarea \n                                        value={selectedNode.data.firebaseServiceAccountJson || ''}`,
    replacement: `<div className="flex items-center justify-between">\n                                       <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">Service Account JSON</label>\n                                       <button \n                                         onClick={() => setShowHelpFor('firebase')}\n                                         className="text-[9px] text-sky-400 hover:text-sky-300 font-bold transition-colors"\n                                       >\n                                         ❓ Get Token / Help\n                                       </button>\n                                     </div>\n                                      <textarea \n                                        value={selectedNode.data.firebaseServiceAccountJson || ''}`
  },
  {
    target: `<label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">\n                                        GitHub Token {selectedNode.data.integrationToken && <span className="text-green-400 normal-case ml-1">✓ Set</span>}\n                                     </label>`,
    replacement: `<div className="flex items-center justify-between">\n                                       <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">\n                                          GitHub Token {selectedNode.data.integrationToken && <span className="text-green-400 normal-case ml-1">✓ Set</span>}\n                                       </label>\n                                       <button \n                                         onClick={() => setShowHelpFor('github-api')}\n                                         className="text-[9px] text-sky-400 hover:text-sky-300 font-bold transition-colors"\n                                       >\n                                         ❓ Get Token / Help\n                                       </button>\n                                     </div>`
  },
  {
    target: `<label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">\n                                        GitHub Token {selectedNode.data.integrationToken && <span className="text-emerald-400">✓</span>}\n                                     </label>`,
    replacement: `<div className="flex items-center justify-between">\n                                       <label className="text-[10px] font-bold text-cream/50 uppercase tracking-wider">\n                                          GitHub Token {selectedNode.data.integrationToken && <span className="text-emerald-400">✓</span>}\n                                       </label>\n                                       <button \n                                         onClick={() => setShowHelpFor('github-api')}\n                                         className="text-[9px] text-sky-400 hover:text-sky-300 font-bold transition-colors"\n                                       >\n                                         ❓ Get Token / Help\n                                       </button>\n                                     </div>`
  }
];

helpTriggers.forEach((trig, idx) => {
  const pos = content.indexOf(trig.target);
  if (pos === -1) {
    console.error(`ERROR: Help Trigger Target ${idx+1} not found!`);
  } else {
    content = content.replace(trig.target, trig.replacement);
    console.log(`Successfully added Help Trigger ${idx+1}.`);
  }
});

// Restore CRLF for Windows
fs.writeFileSync(filePath, content.replace(/\n/g, '\r\n'), 'utf8');
console.log('Done with config enhancements!');
