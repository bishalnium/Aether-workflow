import fs from 'fs';
import readline from 'readline';

const fileStream = fs.createReadStream('C:\\Users\\bisha\\.gemini\\antigravity-ide\\brain\\c3cf0dbe-5052-4b84-a6ab-3bde8bd5e766\\.system_generated\\logs\\transcript.jsonl');
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

const stepsToExtract = [
  2304, 2308, 2314, 2320, 2324,
  2403, 2409, 2413, 2417, 2419, 2429,
  2507, 2511, 2521, 2529,
  2716, 2720, 2722, 2724, 2726,
  3118, 3134, 3138, 3152
];

rl.on('line', (line) => {
  try {
    const obj = JSON.parse(line);
    if (stepsToExtract.includes(obj.step_index)) {
      if (obj.tool_calls) {
        obj.tool_calls.forEach((tc, tcIdx) => {
          if (tc.args && tc.args.TargetFile && tc.args.TargetFile.includes('Builder.tsx')) {
            const outPath = `scratch/step_${obj.step_index}_tc_${tcIdx}_${tc.name}.json`;
            fs.writeFileSync(outPath, JSON.stringify(tc.args, null, 2), 'utf8');
            console.log(`Wrote step ${obj.step_index} tool ${tc.name} arguments to ${outPath}`);
          }
        });
      }
    }
  } catch (e) {
  }
});

rl.on('close', () => {
  console.log('Finished extracting logs.');
});
