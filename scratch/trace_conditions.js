import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8');
const lines = content.split('\n');

// We want to print lines around line 4327 and 4434 and see the indentation or block starts.
console.log('Lines 4240-4275:');
for (let i = 4240; i <= 4275; i++) {
  console.log(`${i}: ${lines[i-1].trim()}`);
}

console.log('\nLines 4315-4340:');
for (let i = 4315; i <= 4340; i++) {
  console.log(`${i}: ${lines[i-1].trim()}`);
}

console.log('\nLines 4425-4450:');
for (let i = 4425; i <= 4450; i++) {
  console.log(`${i}: ${lines[i-1].trim()}`);
}
