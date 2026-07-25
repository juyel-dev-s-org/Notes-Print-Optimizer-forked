const fs = require('fs');
let code = fs.readFileSync('components/views/WorkflowUI.tsx', 'utf8');

// replace all import { WorkflowUIProps } from '../types'; which might be lingering
code = code.replace(/import \{ WorkflowUIProps \} from '\.\.\/types';/g, '');

const importRegex = /^import\s+[\s\S]*?from\s+['"][^'"]+['"];?/gm;
const imports = [];
let match;

let codeWithoutImports = code.replace(importRegex, (m) => {
  imports.push(m);
  return '';
});

// also remove any loose imports like "import React from 'react';" 
const importRegex2 = /^import\s+.*?;\n?/gm;
codeWithoutImports = codeWithoutImports.replace(importRegex2, (m) => {
  imports.push(m);
  return '';
});


let finalCode = "'use client';\n\n" + Array.from(new Set(imports)).join('\n') + "\n\n" + codeWithoutImports.replace(/'use client';\n/g, '');

fs.writeFileSync('components/views/WorkflowUI.tsx', finalCode);
