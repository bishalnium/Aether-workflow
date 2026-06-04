import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8');
const lines = content.split('\r\n'); // Builder.tsx uses CRLF
const linesLF = content.split('\n');

console.log(`Total lines using CRLF split: ${lines.length}`);
console.log(`Total lines using LF split: ${linesLF.length}`);

const models = ['google-sheets', 'notion', 'discord', 'telegram-bot', 'github-api', 'firebase', 'db-write'];

models.forEach((model) => {
  console.log(`\n--- Model: ${model} ---`);
  let index = -1;
  while ((index = content.indexOf(`model === '${model}'`, index + 1)) !== -1) {
    // Find line number
    const sub = content.substring(0, index);
    const lineNum = sub.split('\n').length;
    
    // Print 15 lines before and 15 lines after
    console.log(`Occurrence at line ${lineNum}:`);
    const lineLFIndex = lineNum - 1;
    for (let i = Math.max(0, lineLFIndex - 5); i <= Math.min(linesLF.length - 1, lineLFIndex + 10); i++) {
      console.log(`${i + 1}: ${linesLF[i].trim()}`);
    }
  }
});
