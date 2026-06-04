import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8');
const lines = content.split('\n');

console.log('--- firebase block ---');
for (let i = 4850; i < 4920; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
