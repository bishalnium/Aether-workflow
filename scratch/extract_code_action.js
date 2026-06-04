import fs from 'fs';
import readline from 'readline';

const fileStream = fs.createReadStream('C:\\Users\\bisha\\.gemini\\antigravity-ide\\brain\\c3cf0dbe-5052-4b84-a6ab-3bde8bd5e766\\.system_generated\\logs\\transcript.jsonl');
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

const matches = [];

rl.on('line', (line) => {
  if (line.includes('tool_calls')) {
    try {
      const obj = JSON.parse(line);
      if (obj.tool_calls) {
        obj.tool_calls.forEach(tc => {
          if ((tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') && 
              tc.args && tc.args.TargetFile && tc.args.TargetFile.includes('Builder.tsx')) {
            matches.push({
              step_index: obj.step_index,
              name: tc.name,
              args: tc.args
            });
          }
        });
      }
    } catch (e) {}
  }
});

rl.on('close', () => {
  console.log(`Found ${matches.length} matching replace actions on Builder.tsx`);
  
  // Find Multi Match #17 (step 3118) and Multi Match #18 (step 3152)
  const targetSteps = [3118, 3152, 2403, 2521];
  const targetMatches = matches.filter(m => targetSteps.includes(m.step_index));
  
  targetMatches.forEach((m) => {
    console.log(`\n=========================================`);
    console.log(`Step ${m.step_index} - Tool ${m.name}`);
    const args = m.args;
    console.log(`Instruction: ${args.Instruction}`);
    console.log(`Description: ${args.Description}`);
    
    let chunks;
    if (typeof args.ReplacementChunks === 'string') {
      try {
        // Use eval to safely parse the stringified JSON array containing raw control characters/newlines
        chunks = eval('(' + args.ReplacementChunks + ')');
      } catch (e) {
        console.error('Failed to eval chunks string:', e.message);
      }
    } else {
      chunks = args.ReplacementChunks;
    }
    
    if (Array.isArray(chunks)) {
      console.log(`Chunks count: ${chunks.length}`);
      chunks.forEach((chunk, cidx) => {
        console.log(`  Chunk ${cidx+1} (lines ${chunk.StartLine}-${chunk.EndLine}):`);
        console.log(`    Target length: ${chunk.TargetContent.length}`);
        console.log(`    Target Content:\n${chunk.TargetContent.trim()}\n`);
        console.log(`    Replacement length: ${chunk.ReplacementContent.length}`);
        console.log(`    Replacement Content:\n${chunk.ReplacementContent.trim()}\n`);
      });
    } else {
      console.log('ReplacementChunks is not an array:', typeof chunks);
    }
  });
});
