import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8');
const lines = content.split('\n');

const keyword = 'showSettings';
lines.forEach((line, idx) => {
  if (line.includes(keyword)) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
