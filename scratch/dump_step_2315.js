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
      fs.writeFileSync('scratch/step_2315_content.txt', obj.content, 'utf8');
      console.log('Wrote step 2315 content to scratch/step_2315_content.txt');
    }
  } catch (e) {}
});
