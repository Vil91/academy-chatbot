import fs from 'node:fs';
import path from 'node:path';

// Loads the approved Academy content from /knowledge/*.md.
// The knowledge base is small, so the whole of it goes into the prompt:
// no embeddings or vector store are needed at this size.
export function loadKnowledge(dir) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .sort();

  return files.map((file) => {
    const text = fs.readFileSync(path.join(dir, file), 'utf8').trim();
    const heading = text.match(/^#\s+(.+)$/m);
    return {
      id: path.basename(file, '.md'),
      title: heading ? heading[1].trim() : file,
      text,
    };
  });
}
