import fs from 'fs';
import readline from 'readline';

const fileStream = fs.createReadStream('C:\\Users\\bisha\\.gemini\\antigravity-ide\\brain\\c3cf0dbe-5052-4b84-a6ab-3bde8bd5e766\\.system_generated\\logs\\transcript.jsonl');
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

let count = 0;
rl.on('line', (line) => {
  if (line.includes('Builder.tsx') && (line.includes('write_to_file') || line.includes('replace_file_content') || line.includes('multi_replace_file_content'))) {
    count++;
    try {
      const obj = JSON.parse(line);
      console.log(`\nMatch #${count} - Step: ${obj.step_index}, Type: ${obj.type}, Source: ${obj.source}`);
      if (obj.tool_calls) {
        obj.tool_calls.forEach(tc => {
          if (tc.Arguments) {
            console.log(`Tool: ${tc.ToolName}`);
            // Let's print arguments summary
            const args = typeof tc.Arguments === 'string' ? JSON.parse(tc.Arguments) : tc.Arguments;
            console.log(`TargetFile: ${args.TargetFile}`);
            console.log(`Instruction: ${args.Instruction}`);
            console.log(`Description: ${args.Description}`);
            if (args.TargetContent) {
              console.log(`TargetContent length: ${args.TargetContent.length}`);
            }
            if (args.ReplacementContent) {
              console.log(`ReplacementContent length: ${args.ReplacementContent.length}`);
            }
            if (args.ReplacementChunks) {
              console.log(`ReplacementChunks: ${args.ReplacementChunks.length} chunks`);
              args.ReplacementChunks.forEach((c, idx) => {
                console.log(`  Chunk ${idx+1}: line ${c.StartLine}-${c.EndLine}, TargetContent length: ${c.TargetContent.length}, ReplacementContent length: ${c.ReplacementContent.length}`);
              });
            }
          }
        });
      }
    } catch (e) {
      console.error('Failed to parse line:', e.message);
    }
  }
});

rl.on('close', () => {
  console.log(`\nDone scanning logs. Found ${count} matching steps.`);
});
