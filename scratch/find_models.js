import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('selectedNode.data.model ===')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
  if (line.includes('selectedNode.data.category ===')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
