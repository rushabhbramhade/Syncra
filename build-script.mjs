
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = __dirname;
const tempBuildDir = path.join(__dirname, '.temp-build');

console.log('Creating temporary build directory...');
if (fs.existsSync(tempBuildDir)) {
  fs.rmSync(tempBuildDir, { recursive: true, force: true });
}
fs.mkdirSync(tempBuildDir, { recursive: true });

console.log('Copying files to temporary directory (skipping app/api/auth)...');
const copyDir = (src, dest) => {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      // Skip app/api/auth entirely
      if (srcPath === path.join(sourceDir, 'app', 'api', 'auth')) {
        console.log('Skipping app/api/auth...');
        continue;
      }
      
      copyDir(srcPath, destPath);
    }
  } else {
    fs.copyFileSync(src, dest);
  }
};
copyDir(sourceDir, tempBuildDir);

console.log('Running build in temporary directory...');
try {
  execSync('npm run build', {
    cwd: tempBuildDir,
    stdio: 'inherit'
  });
  console.log('Build successful! Copying output back...');
  
  // Copy .next back if needed
  if (fs.existsSync(path.join(tempBuildDir, '.next'))) {
    if (fs.existsSync(path.join(sourceDir, '.next'))) {
      fs.rmSync(path.join(sourceDir, '.next'), { recursive: true, force: true });
    }
    fs.cpSync(path.join(tempBuildDir, '.next'), path.join(sourceDir, '.next'), { recursive: true });
  }
  
  console.log('Done!');
} catch (err) {
  console.error('Build failed!', err);
  process.exit(1);
}
