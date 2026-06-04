import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8');
const lines = content.split('\n');

// Search for node types or categories of nodes in Builder.tsx
// e.g. search for category: 'Database' or model: 'db-write'
const keywords = ['db-write', 'ddg-search', 'rss-reader', 'github-api'];
keywords.forEach(kw => {
  console.log(`\nSearching for: ${kw}`);
  lines.forEach((line, idx) => {
    if (line.includes(kw) && line.includes('category')) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  });
});
