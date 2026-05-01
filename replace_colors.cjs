const fs = require('fs');
const path = require('path');

function replaceColorsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Background colors
  content = content.replace(/backgroundColor:\s*['"]#(121318|18181b|1a1a1a|0f172a|0a0b0e|1e1b4b)['"]/gi, "backgroundColor: 'var(--bg-color)'");
  content = content.replace(/backgroundColor:\s*['"]#(1e293b|1f1f23|16181d|27272a|3f3f46)['"]/gi, "backgroundColor: 'var(--bg-card-hover)'");
  content = content.replace(/backgroundColor:\s*['"]black['"]/gi, "backgroundColor: 'var(--bg-color)'");

  // Text colors
  content = content.replace(/color:\s*['"]white['"]/gi, "color: 'var(--text-main)'");
  content = content.replace(/color:\s*['"]#(e2e8f0|f8fafc)['"]/gi, "color: 'var(--text-main)'");
  content = content.replace(/color:\s*['"]rgba\(255,\s*255,\s*255,\s*0\.[789]\)['"]/gi, "color: 'var(--text-muted)'");
  content = content.replace(/color:\s*['"]#64748b['"]/gi, "color: 'var(--text-muted)'");

  // Borders
  content = content.replace(/border:\s*['"]1px solid rgba\(255,\s*255,\s*255,\s*0\.[0-9]+\)['"]/gi, "border: '1px solid var(--border-color)'");
  content = content.replace(/borderBottom:\s*['"]1px solid rgba\(255,\s*255,\s*255,\s*0\.[0-9]+\)['"]/gi, "borderBottom: '1px solid var(--border-color)'");
  content = content.replace(/borderTop:\s*['"]1px solid rgba\(255,\s*255,\s*255,\s*0\.[0-9]+\)['"]/gi, "borderTop: '1px solid var(--border-color)'");

  // Other specific rgba whites
  content = content.replace(/backgroundColor:\s*['"]rgba\(255,\s*255,\s*255,\s*0\.[0-9]+\)['"]/gi, "backgroundColor: 'var(--bg-card)'");
  content = content.replace(/backgroundColor:\s*['"]rgba\(0,\s*0,\s*0,\s*0\.2\)['"]/gi, "backgroundColor: 'var(--bg-card-hover)'");

  fs.writeFileSync(filePath, content, 'utf8');
}

function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      replaceColorsInFile(fullPath);
    }
  }
}

const targetDir = path.join(__dirname, 'src', 'pages');
processDirectory(targetDir);
console.log('Colors replaced successfully!');
