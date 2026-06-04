import fs from 'fs';
import readline from 'readline';

const fileStream = fs.createReadStream('C:\\Users\\bisha\\.gemini\\antigravity-ide\\brain\\c3cf0dbe-5052-4b84-a6ab-3bde8bd5e766\\.system_generated\\logs\\transcript.jsonl');
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

let matches = [];

rl.on('line', (line) => {
  if (line.includes('Builder.tsx') && line.includes('tool_calls')) {
    try {
      const obj = JSON.parse(line);
      if (obj.tool_calls) {
        obj.tool_calls.forEach(tc => {
          if (tc.name === 'write_to_file' || tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') {
            matches.push({
              step: obj.step_index,
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
  console.log(`Found ${matches.length} tool calls modifying Builder.tsx`);
  
  // Find the last write_to_file call or very large replace_file_content call that contains the entire file.
  // Wait, did any subagent write the entire file or large chunks?
  matches.forEach((m, idx) => {
    const args = m.args;
    if (!args) return;
    const desc = args.Description || '';
    const codeLen = args.CodeContent ? args.CodeContent.length : 0;
    const replLen = args.ReplacementContent ? args.ReplacementContent.length : 0;
    console.log(`[${idx+1}] Step ${m.step}: Tool ${m.name}, Desc: "${desc}", CodeLen: ${codeLen}, ReplLen: ${replLen}`);
  });
});
