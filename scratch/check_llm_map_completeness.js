import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8');
const lines = content.split('\n');

const getLineNumber = (index) => {
  let chars = 0;
  for (let i = 0; i < lines.length; i++) {
    chars += lines[i].length + 1; // +1 for newline character
    if (chars >= index) return i + 1;
  }
  return lines.length;
};

const models = ['google-sheets', 'notion', 'discord', 'telegram-bot', 'github-api', 'firebase', 'db-write'];

for (const model of models) {
  const searchStr = `model === '${model}'`;
  let idx = 0;
  while (true) {
    idx = content.indexOf(searchStr, idx);
    if (idx === -1) break;
    
    // Check next 6000 characters
    const chunk = content.substring(idx, idx + 6000);
    const hasLLM = chunk.includes('llmAutoMap') || chunk.includes('✨ LLM Agent Auto-Format/Map');
    const lineNum = getLineNumber(idx);
    console.log(`Model: ${model} at line ${lineNum} has LLM mapping UI: ${hasLLM}`);
    idx += searchStr.length;
  }
}
