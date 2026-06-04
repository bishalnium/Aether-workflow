import fs from 'fs';
import readline from 'readline';

const fileStream = fs.createReadStream('C:\\Users\\bisha\\.gemini\\antigravity-ide\\brain\\c3cf0dbe-5052-4b84-a6ab-3bde8bd5e766\\.system_generated\\logs\\transcript.jsonl');
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  try {
    const obj = JSON.parse(line);
    if (obj.step_index === 2314) {
      console.log('Step 2314 details:');
      console.log('Keys:', Object.keys(obj));
      if (obj.tool_calls) {
        console.log('tool_calls count:', obj.tool_calls.length);
        obj.tool_calls.forEach((tc, idx) => {
          console.log(`- Tool ${idx}: name=${tc.name}`);
          console.log('  args targetFile:', tc.args && tc.args.TargetFile);
        });
      }
    }
  } catch (e) {}
});
