import fs from 'fs';
import readline from 'readline';

const fileStream = fs.createReadStream('C:\\Users\\bisha\\.gemini\\antigravity-ide\\brain\\c3cf0dbe-5052-4b84-a6ab-3bde8bd5e766\\.system_generated\\logs\\transcript.jsonl');
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

const steps = [];

rl.on('line', (line) => {
  try {
    const obj = JSON.parse(line);
    if (obj.tool_calls) {
      obj.tool_calls.forEach(tc => {
        if (tc.args && tc.args.TargetFile && tc.args.TargetFile.includes('Builder.tsx')) {
          steps.push({
            step: obj.step_index,
            type: obj.type,
            toolName: tc.name,
            desc: tc.args.Description || tc.args.Instruction || ''
          });
        }
      });
    }
  } catch (e) {}
});

rl.on('close', () => {
  console.log('Steps modifying Builder.tsx:');
  steps.forEach(s => {
    console.log(`- Step ${s.step} (${s.type}): ${s.toolName} - "${s.desc.substring(0, 80)}"`);
  });
});
