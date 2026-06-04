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
    if (obj.step_index === 2315) {
      console.log('Step 2315 keys:', Object.keys(obj));
      console.log('Step 2315 keys and string lengths:');
      for (const k of Object.keys(obj)) {
        console.log(`- ${k}: typeof ${typeof obj[k]} (length: ${JSON.stringify(obj[k]).length})`);
      }
      if (obj.tool_calls) {
        console.log('tool_calls type:', typeof obj.tool_calls);
        console.log('tool_calls keys/indices:', Object.keys(obj.tool_calls));
      }
    }
  } catch (e) {}
});
