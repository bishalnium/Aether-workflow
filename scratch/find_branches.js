import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8');
const lines = content.split('\n');

// We want to extract the structure of categories and models in the config sidebar
// The config sidebar seems to start around line 4000.
// Let's find the lines from 4000 to 6000 and match lines that look like:
// - selectedNode.data.category === '...'
// - selectedNode.data.model === '...'

for (let i = 3999; i < 6000; i++) {
  const line = lines[i];
  if (!line) continue;
  
  if (line.includes('category ===') || line.includes('model ===')) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
}
