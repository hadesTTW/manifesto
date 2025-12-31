const fs = require('fs');
const path = require('path');

(async () => {
  const { marked } = await import('marked');

  const sourcePath = path.join(__dirname, 'manifesto', 'source.md');
  const indexPath = path.join(__dirname, 'manifesto', 'index.html');

  try {
    const markdown = fs.readFileSync(sourcePath, 'utf8');
    
    // Custom renderer if needed, or just default
    const htmlContent = marked.parse(markdown);

    // Read existing index.html to inject content
    let indexHtml = fs.readFileSync(indexPath, 'utf8');
    
    // Find where to inject - we'll look for <article>...</article>
    // This is a simple replacement for now.
    // Ideally we might want a placeholder or something more robust.
    const articleRegex = /<article>[\s\S]*?<\/article>/;
    const newArticle = `<article>\n${htmlContent}\n</article>`;
    
    if (articleRegex.test(indexHtml)) {
        indexHtml = indexHtml.replace(articleRegex, newArticle);
    } else {
        console.error('Could not find <article> tag in index.html');
        process.exit(1);
    }

    fs.writeFileSync(indexPath, indexHtml);
    console.log('Successfully updated manifesto/index.html with content from source.md');

  } catch (err) {
    console.error('Error processing markdown:', err);
  }
})();
