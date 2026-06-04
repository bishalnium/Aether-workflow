import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8').replace(/\r\n/g, '\n');

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
            startBrace: startBraceIdx,
            endBrace: nextBrace + 1,
            modelName,
            content: content.substring(startBraceIdx, nextBrace + 1)
          };
        }
      }
    }
  }
  return null;
}

const modelName = 'google-sheets';
const block = findBlockRange(content, modelName);
if (block) {
  console.log(`Found block for ${modelName}:`);
  console.log(`Length: ${block.content.length}`);
  console.log(`Snippet:\n${block.content.substring(0, 200)}\n...\n${block.content.substring(block.content.length - 200)}`);
} else {
  console.log(`Block not found for ${modelName}`);
}
