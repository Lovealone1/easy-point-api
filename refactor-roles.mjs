import fs from 'fs';
import path from 'path';

function getRelativePath(fromFile, toFile) {
  let rel = path.relative(path.dirname(fromFile), toFile).replace(/\\/g, '/');
  if (!rel.startsWith('.')) {
    rel = './' + rel;
  }
  return rel.replace(/\.ts$/, '.js');
}

const srcDir = path.join(process.cwd(), 'src');
const roleEnumPath = path.join(srcDir, 'common', 'enums', 'role.enum.ts');

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(file));
    } else if (file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walkDir(srcDir);

let changedFiles = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Find all matches
  const importRegex = /import\s+{([^}]*)}\s+from\s+['"]@prisma\/client['"];?/g;
  
  content = content.replace(importRegex, (match, inner) => {
    const imports = inner.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const hasRole = imports.includes('Role');
    if (!hasRole) return match;
    
    const otherImports = imports.filter(i => i !== 'Role');
    const relPath = getRelativePath(file, roleEnumPath);
    
    let result = `import { Role } from '${relPath}';`;
    if (otherImports.length > 0) {
      result += `\nimport { ${otherImports.join(', ')} } from '@prisma/client';`;
    }
    return result;
  });

  // also catch cases where Prisma might be imported like: import { Prisma, Role } from '@prisma/client'
  // the regex above catches it.
  
  const currentContent = fs.readFileSync(file, 'utf8');
  if (content !== currentContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
    changedFiles++;
  }
}

console.log(`Finished. Changed ${changedFiles} files.`);
