import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8');
const lines = content.split('\n');

console.log('Comparing blocks...');

// Let's print the lines from 4880 to 4960
for (let i = 4880; i <= 4960; i++) {
  console.log(`${i}: ${lines[i-1].trim()}`);
}
