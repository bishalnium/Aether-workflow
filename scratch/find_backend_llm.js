import fs from 'fs';

const content = fs.readFileSync('backend/src/engine/nodeHandlers.ts', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('llmAutoMap')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
