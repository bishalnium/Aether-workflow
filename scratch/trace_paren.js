import fs from 'fs';

const content = fs.readFileSync('components/Builder.tsx', 'utf8').replace(/\r\n/g, '\n');
const lines = content.split('\n');

const query = "selectedNode.data.category === 'Web & Search' ? (";
const idx = content.indexOf(query);
console.log(`Found index for Web & Search query: ${idx} at line ${content.substring(0, idx).split('\n').length}`);

if (idx !== -1) {
  const startParenIdx = idx + query.length - 1;
  let parenCount = 1;
  let inString = false;
  let stringChar = null;
  
  for (let i = startParenIdx + 1; i < content.length; i++) {
    const char = content[i];
    
    if ((char === '"' || char === "'" || char === '`') && content[i-1] !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = null;
      }
    }
    
    if (!inString) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount === 0) {
        console.log(`Paren count balanced at index ${i}, line ${content.substring(0, i).split('\n').length}`);
        console.log("Snippet around matching end:");
        console.log(content.substring(i - 100, i + 100));
        break;
      }
    }
  }
}
