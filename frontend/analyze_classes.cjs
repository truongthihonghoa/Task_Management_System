const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
const classCounts = {};
const elementClassCounts = {};

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const classNameRegex = /className\s*=\s*(['"])(.*?)\1|className\s*=\s*\{\s*`([^`]*)`\s*\}/g;
  let match;
  while ((match = classNameRegex.exec(content)) !== null) {
    let clsString = match[2] || match[3] || '';
    clsString = clsString.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    if (!clsString || clsString.includes('${')) continue;
    
    const beforeMatch = content.substring(Math.max(0, match.index - 50), match.index);
    const elementMatch = beforeMatch.match(/<([a-zA-Z0-9_]+)[^>]*$/);
    const element = elementMatch ? elementMatch[1] : 'unknown';

    const key = clsString;
    classCounts[key] = (classCounts[key] || 0) + 1;
    
    const elemKey = element + '::' + clsString;
    elementClassCounts[elemKey] = (elementClassCounts[elemKey] || 0) + 1;
  }
});

const sortedClasses = Object.entries(classCounts).sort((a, b) => b[1] - a[1]);
console.log('Top 50 exact class strings:');
sortedClasses.slice(0, 50).forEach(([cls, count]) => {
  if(count >= 3) console.log(`${count}: ${cls}`);
});

const sortedElemClasses = Object.entries(elementClassCounts).sort((a, b) => b[1] - a[1]);
console.log('\nTop 50 element + exact class strings:');
sortedElemClasses.slice(0, 50).forEach(([cls, count]) => {
  if(count >= 3) console.log(`${count}: ${cls}`);
});
