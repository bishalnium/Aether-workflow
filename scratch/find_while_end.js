import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8');
const lines = content.split('\n');

let openWhile = false;
let braceCount = 0;
let whileLine = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('while (queue.length > 0)')) {
    openWhile = true;
    whileLine = i + 1;
    braceCount = 0;
    console.log(`while starts at line ${whileLine}`);
  }
  
  if (openWhile) {
    // count open/close braces
    for (let char of line) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }
    if (braceCount === 0) {
      console.log(`while ends at line ${i + 1}`);
      openWhile = false;
    }
  }
}
