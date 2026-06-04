import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8');
const lines = content.split('\n');

const blocks = [
  { name: 'db-write (first)', start: 4495, end: 4509 },
  { name: 'db-write (second)', start: 4892, end: 4906 },
  { name: 'github-api (first)', start: 4956, end: 5127 },
  { name: 'telegram-bot', start: 5129, end: 5281 },
  { name: 'notion', start: 5282, end: 5448 },
  { name: 'discord', start: 5449, end: 5561 },
  { name: 'google-sheets', start: 5563, end: 5701 },
  { name: 'github-api (second)', start: 5702, end: 5766 },
  { name: 'firebase', start: 5767, end: 5920 }
];

blocks.forEach(b => {
  const blockLines = lines.slice(b.start - 1, b.end);
  const blockContent = blockLines.join('\n');
  const hasLLM = blockContent.includes('llmAutoMap');
  console.log(`${b.name} (${b.start} to ${b.end}) has LLM: ${hasLLM}`);
});
