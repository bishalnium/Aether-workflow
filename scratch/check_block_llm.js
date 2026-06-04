import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8');

// Find all model block matches
const regex = /\{selectedNode\.data\.model === '([^']+)' && \(/g;
let match;
const blocks = [];

while ((match = regex.exec(content)) !== null) {
  const modelName = match[1];
  const startIdx = match.index;
  
  // Find matching closing block index
  // We can approximate by looking for the next selectedNode.data.model === or category ===
  // or just matching brackets. Let's find the next "model === " check.
  let endIdx = content.indexOf('{selectedNode.data.model ===', startIdx + 1);
  if (endIdx === -1) {
    endIdx = content.indexOf(') : selectedNode.data.category ===', startIdx + 1);
  }
  if (endIdx === -1) {
    endIdx = startIdx + 5000;
  }
  
  const blockContent = content.substring(startIdx, endIdx);
  const hasLLM = blockContent.includes('llmAutoMap') || blockContent.includes('✨ LLM Agent Auto-Format/Map');
  
  // Get line number
  const lineNum = content.substring(0, startIdx).split('\n').length;
  
  console.log(`Block: ${modelName} at line ${lineNum} (length: ${blockContent.length}) has LLM: ${hasLLM}`);
}
