import fs from 'fs';

const files = fs.readdirSync('scratch').filter(f => f.startsWith('step_') && f.endsWith('.json'));

files.forEach(f => {
  const content = fs.readFileSync(`scratch/${f}`, 'utf8');
  if (content.includes('truncated')) {
    console.log(`[TRUNCATED] ${f}`);
  } else {
    console.log(`[INTACT]    ${f}`);
  }
});
