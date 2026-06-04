import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8');
const lines = content.split('\r\n');

const getLinesRange = (start, end) => {
  return lines.slice(start - 1, end).map((l, i) => `${start + i}: ${JSON.stringify(l)}`).join('\n');
};

console.log('--- db-write (first) lines 4495 to 4511 ---');
console.log(getLinesRange(4495, 4511));

console.log('\n--- db-write (second) lines 4890 to 4908 ---');
console.log(getLinesRange(4890, 4908));

console.log('\n--- github-api (second) lines 5735 to 5768 ---');
console.log(getLinesRange(5735, 5768));
