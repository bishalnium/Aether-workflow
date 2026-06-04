import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8');
const lines = content.split('\n');

// Print lines 5690 to 5710 with characters so we can inspect carefully.
for (let i = 5690; i <= 5710; i++) {
  console.log(`${i}: ${lines[i-1]}`);
}
