import fs from 'fs';

const filePath = 'components/Builder.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to LF for internal processing
content = content.replace(/\r\n/g, '\n');

const stepsToApply = [
  'step_2304_tc_0_replace_file_content.json',
  'step_2308_tc_0_replace_file_content.json',
  'step_2314_tc_0_replace_file_content.json',
  'step_2320_tc_0_replace_file_content.json',
  'step_2324_tc_0_replace_file_content.json',
  'step_2403_tc_0_multi_replace_file_content.json',
  'step_2409_tc_0_multi_replace_file_content.json',
  'step_2413_tc_0_multi_replace_file_content.json',
  'step_2417_tc_0_replace_file_content.json',
  'step_2419_tc_0_replace_file_content.json',
  'step_2429_tc_0_multi_replace_file_content.json',
  'step_2507_tc_0_replace_file_content.json',
  'step_2511_tc_0_multi_replace_file_content.json',
  'step_2521_tc_0_multi_replace_file_content.json',
  'step_2529_tc_0_replace_file_content.json',
  'step_2716_tc_0_replace_file_content.json',
  'step_2720_tc_0_replace_file_content.json',
  'step_2722_tc_0_replace_file_content.json',
  'step_2724_tc_0_replace_file_content.json',
  'step_2726_tc_0_replace_file_content.json',
  'step_3118_tc_0_multi_replace_file_content.json',
  'step_3134_tc_0_replace_file_content.json',
  'step_3138_tc_0_replace_file_content.json',
  'step_3152_tc_0_multi_replace_file_content.json'
];

function cleanContent(str) {
  if (typeof str !== 'string') return '';
  let s = str.trim();
  if (s.startsWith('"') && s.endsWith('"')) {
    try {
      // Try to parse as JSON string to unescape it
      return JSON.parse(s);
    } catch (e) {
      // Manual fallback
      s = s.slice(1, -1);
    }
  }
  // Convert escaped newlines if they are literal backslash-n
  // Note: JSON.parse does this, but if it wasn't valid JSON or didn't have outer quotes:
  return s.replace(/\\r\\n/g, '\n')
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
}

function normalize(str) {
  return cleanContent(str).replace(/\r\n/g, '\n');
}

for (const stepFile of stepsToApply) {
  const jsonPath = `scratch/${stepFile}`;
  if (!fs.existsSync(jsonPath)) {
    console.log(`Skipping missing step file: ${jsonPath}`);
    continue;
  }

  console.log(`\n--- Applying ${stepFile} ---`);
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  if (stepFile.includes('multi_replace_file_content')) {
    let chunks = data.ReplacementChunks;
    if (typeof chunks === 'string') {
      chunks = JSON.parse(chunks);
    }
    console.log(`Processing ${chunks.length} chunks...`);
    chunks.forEach((chunk, idx) => {
      const target = normalize(chunk.TargetContent);
      const replacement = normalize(chunk.ReplacementContent);
      
      const pos = content.indexOf(target);
      if (pos === -1) {
        console.error(`ERROR: Chunk ${idx+1} not found in Builder.tsx! Target preview (length ${target.length}):\n${target.substring(0, 150)}\n...`);
      } else {
        // Double check uniqueness
        const secondPos = content.indexOf(target, pos + 1);
        if (secondPos !== -1 && !chunk.AllowMultiple) {
          console.warn(`WARNING: Target occurs multiple times in file! Match 1: ${pos}, Match 2: ${secondPos}`);
        }
        content = content.replace(target, replacement);
        console.log(`  Chunk ${idx+1} successfully replaced.`);
      }
    });
  } else {
    // replace_file_content
    const target = normalize(data.TargetContent);
    const replacement = normalize(data.ReplacementContent);

    const pos = content.indexOf(target);
    if (pos === -1) {
      console.error(`ERROR: Target not found in Builder.tsx! Target preview (length ${target.length}):\n${target.substring(0, 150)}\n...`);
    } else {
      const secondPos = content.indexOf(target, pos + 1);
      if (secondPos !== -1 && data.AllowMultiple !== 'true' && data.AllowMultiple !== true) {
        console.warn(`WARNING: Target occurs multiple times in file! Match 1: ${pos}, Match 2: ${secondPos}`);
      }
      content = content.replace(target, replacement);
      console.log(`  Replaced target successfully.`);
    }
  }
}

// Convert back to CRLF (\r\n) before writing
const finalContent = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('\nReconstruction complete!');
