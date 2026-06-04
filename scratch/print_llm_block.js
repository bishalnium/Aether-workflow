import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8');
const lines = content.split('\n');

for (let i = 5627; i <= 5698; i++) {
  console.log(`${i}: ${JSON.stringify(lines[i-1])}`);
}
