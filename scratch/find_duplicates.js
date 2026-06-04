import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8');
const lines = content.split('\n');

// Let's print out lines around the end of category Web & Search and the beginning of the next Database.
console.log('Lines 4760-4840:');
for (let i = 4760; i <= 4840; i++) {
  console.log(`${i}: ${lines[i-1]}`);
}
