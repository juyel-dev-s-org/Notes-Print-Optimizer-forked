const fs = require('fs');
const content = fs.readFileSync('components/views/WorkflowUI.tsx', 'utf8');
const lines = content.split('\n');
const imports = [];
const rest = [];
let useClient = '';

for (const line of lines) {
  if (line.startsWith("'use client'") || line.startsWith('"use client"')) {
    useClient = line;
  } else if (line.startsWith('import ')) {
    imports.push(line);
  } else {
    rest.push(line);
  }
}

// But wait, multiline imports!
