import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8');
const lines = content.split('\n');

const keyword = 'executeWorkflow';
console.log(`Searching for: ${keyword}`);
lines.forEach((line, idx) => {
  if (line.includes(keyword)) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
