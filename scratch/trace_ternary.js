import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8');
const lines = content.split('\n');

let depth = 0;
let categoriesStack = [];

for (let i = 4000; i < 5000; i++) {
  const line = lines[i];
  if (!line) continue;
  
  const lineNum = i + 1;
  const trimmed = line.trim();
  
  if (trimmed.includes('category ===')) {
    console.log(`${lineNum}: category check found: ${trimmed}`);
  }
  
  if (trimmed.startsWith(') : selectedNode.data.category ===')) {
    categoriesStack.pop();
    const match = trimmed.match(/'([^']+)'/);
    const cat = match ? match[1] : 'unknown';
    categoriesStack.push(cat);
    console.log(`  -> Stack state at ${lineNum}: [${categoriesStack.join(', ')}]`);
  } else if (trimmed.startsWith('{selectedNode.data.category ===')) {
    const match = trimmed.match(/'([^']+)'/);
    const cat = match ? match[1] : 'unknown';
    categoriesStack.push(cat);
    console.log(`  -> Stack state at ${lineNum}: [${categoriesStack.join(', ')}]`);
  }
}
