import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8');
const lines = content.split('\n');

console.log('--- ddg-search first block ---');
for (let i = 4220; i < 4237; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}

console.log('\n--- ddg-search second block ---');
for (let i = 4395; i < 4412; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
