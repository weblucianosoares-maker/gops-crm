
import fs from 'fs';

const content = fs.readFileSync('c:\\Users\\weblu\\Downloads\\efraim-saúde\\src\\components\\LeadDetailDrawer.tsx', 'utf8');

let divCount = 0;
let braceCount = 0;
let parenCount = 0;

for (let i = 0; i < content.length; i++) {
  if (content.substring(i, i + 5) === '<div ') divCount++;
  if (content.substring(i, i + 6) === '</div>') divCount--;
  if (content[i] === '{') braceCount++;
  if (content[i] === '}') braceCount--;
  if (content[i] === '(') parenCount++;
  if (content[i] === ')') parenCount--;
}

console.log(`Divs: ${divCount}`);
console.log(`Braces: ${braceCount}`);
console.log(`Parens: ${parenCount}`);
