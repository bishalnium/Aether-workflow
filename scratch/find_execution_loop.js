import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8');
const lines = content.split('\n');

// Let's search for "while" or loop structures inside executeWorkflow in Builder.tsx
// Let's print lines 2078 to 2200.
for (let i = 2078; i <= 2200; i++) {
  console.log(`${i}: ${lines[i-1]}`);
}
