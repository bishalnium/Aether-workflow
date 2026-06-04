import fs from 'fs';
const lines = fs.readFileSync('components/Builder.tsx', 'utf8').split('\n');
for (let i = 5700; i <= 5770; i++) {
  console.log(`${i}: ${JSON.stringify(lines[i - 1])}`);
}
