const fs = require('fs');
const path = require('path');

const projectPath = path.join(__dirname, '../ios/App/App.xcodeproj/project.pbxproj');

if (!fs.existsSync(projectPath)) {
  console.error(`Error: Xcode project file not found at ${projectPath}`);
  process.exit(1);
}

let content = fs.readFileSync(projectPath, 'utf8');

// Match CURRENT_PROJECT_VERSION = <digits>;
const regex = /CURRENT_PROJECT_VERSION\s*=\s*(\d+);/g;
let match = regex.exec(content);

if (!match) {
  console.error("Error: CURRENT_PROJECT_VERSION not found in project.pbxproj");
  process.exit(1);
}

const currentVersion = parseInt(match[1], 10);
const newVersion = currentVersion + 1;

// Replace all occurrences of CURRENT_PROJECT_VERSION
content = content.replace(regex, `CURRENT_PROJECT_VERSION = ${newVersion};`);

fs.writeFileSync(projectPath, content, 'utf8');
console.log(`Success: CURRENT_PROJECT_VERSION bumped from ${currentVersion} to ${newVersion}`);
