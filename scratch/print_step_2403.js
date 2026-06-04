import fs from 'fs';

const stepFile = 'scratch/step_2403_tc_0_multi_replace_file_content.json';
const data = JSON.parse(fs.readFileSync(stepFile, 'utf8'));

console.log('Description:', data.Description);
let chunks = data.ReplacementChunks;
if (typeof chunks === 'string') {
  try {
    chunks = JSON.parse(chunks);
  } catch (e) {
    console.log('Failed to parse chunks as JSON string. Attempting eval cleanup.');
    // Let's replace raw newlines inside strings
    try {
      const cleaned = chunks.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
      chunks = JSON.parse(cleaned);
    } catch (err) {
      console.error('Cleaned JSON parse failed:', err.message);
    }
  }
}

if (Array.isArray(chunks)) {
  console.log(`Found ${chunks.length} chunks`);
  chunks.forEach((c, idx) => {
    console.log(`Chunk ${idx+1}: line ${c.StartLine}-${c.EndLine}`);
    console.log(`  TargetContent starts:`, JSON.stringify(c.TargetContent.substring(0, 100)));
    console.log(`  ReplacementContent length:`, c.ReplacementContent.length);
  });
}
