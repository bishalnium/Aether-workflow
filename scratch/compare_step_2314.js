import fs from 'fs';

const stepData = JSON.parse(fs.readFileSync('scratch/step_2314_tc_0_replace_file_content.json', 'utf8'));
const tc = stepData.TargetContent;
console.log('Last char code:', tc.charCodeAt(tc.length - 1));
console.log('Last 10 chars:', JSON.stringify(tc.substring(tc.length - 10)));
