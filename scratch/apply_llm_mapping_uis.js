import fs from 'fs';

const filePath = 'components/Builder.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Define UI blocks to be inserted.
const dbWriteLLMBlock = `                                  {/* ✨ LLM Auto-Mapping Section */}
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
                                              placeholder="e.g., Output a JSON object representing the database row values to write, matching table schema."
                                              className="w-full bg-black/50 border border-white/10 p-2 text-xs text-cream/90 focus:border-cherry focus:outline-none resize-none rounded-md"
                                            />
                                            <p className="text-[9px] text-gray-500 font-sans">Guide the LLM on how to extract and format the input context for this table.</p>
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
                                                 className="w-full bg-black/50 border border-white/10 p-1.5 text-[11px] text-cream focus:border-orange-400 focus:outline-none rounded-md font-mono"
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
                                  </div>`.replace(/\n/g, '\r\n');

const githubWriteLLMBlock = `                                  {/* ✨ LLM Auto-Mapping Section */}
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
                                              placeholder="e.g., Extract title and body from the input context into a JSON object, like: {'title': '...', 'body': '...'}"
                                              className="w-full bg-black/50 border border-white/10 p-2 text-xs text-cream/90 focus:border-cherry focus:outline-none resize-none rounded-md"
                                            />
                                            <p className="text-[9px] text-gray-500 font-sans">Guide the LLM on how to extract and format the input context for this GitHub request.</p>
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
                                  </div>`.replace(/\n/g, '\r\n');

// For insertions, let's find the specific lines and replace them.
// We split the content on \r\n to match exact line by line structure.
const lines = content.split('\r\n');

// Let's find db-write occurrences first.
// Occurrence 1: starts around index 4495
// Occurrence 2: starts around index 4892
let dbWriteCount = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("selectedNode.data.model === 'db-write'")) {
    dbWriteCount++;
    console.log(`Found db-write model check #${dbWriteCount} at line ${i + 1}`);
    
    // We want to scan forward to find the next </select> and </div> lines
    let selectIdx = -1;
    let selectCloseDivIdx = -1;
    for (let j = i + 1; j < i + 30; j++) {
      if (lines[j].includes('</select>')) {
        selectIdx = j;
      }
      if (selectIdx !== -1 && lines[j].includes('</div>')) {
        selectCloseDivIdx = j;
        break;
      }
    }
    
    if (selectCloseDivIdx !== -1) {
      console.log(`Inserting db-write LLM panel after line ${selectCloseDivIdx + 1}`);
      lines.splice(selectCloseDivIdx + 1, 0, dbWriteLLMBlock);
      // Since we inserted a block, adjust subsequent indices if needed. But we are iterating, so let's continue cautiously.
      // Wait, since lines length increased, let's rebuild and search again or just increment loop index.
      i += 1; // skip past our insertion
    }
  }
}

content = lines.join('\r\n');

// Now let's handle github-api second block.
// Let's search again.
const lines2 = content.split('\r\n');
let githubCount = 0;
for (let i = 0; i < lines2.length; i++) {
  if (lines2[i].includes("selectedNode.data.model === 'github-api'")) {
    githubCount++;
    console.log(`Found github-api model check #${githubCount} at line ${i + 1}`);
    
    if (githubCount === 2) {
      // For the second github block, we want to scan forward to find the file path block or the end of the block.
      // Let's find:
      // }
      // </>;
      // which ends this block. Let's find j where lines2[j] is " </>" or similar.
      let endFragIdx = -1;
      for (let j = i + 1; j < i + 100; j++) {
        if (lines2[j].trim() === '</>' && lines2[j+1].trim() === ')') {
          endFragIdx = j;
          break;
        }
      }
      
      if (endFragIdx !== -1) {
        console.log(`Inserting github-api LLM panel before line ${endFragIdx + 1}`);
        lines2.splice(endFragIdx, 0, githubWriteLLMBlock);
        break;
      }
    }
  }
}

fs.writeFileSync(filePath, lines2.join('\r\n'), 'utf8');
console.log('Successfully completed insertions in Builder.tsx');
