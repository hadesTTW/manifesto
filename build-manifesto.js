const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

const sourcePath = path.join(__dirname, 'manifesto', 'Manifesto of the Anti-AI Movement.docx');
const indexPath = path.join(__dirname, 'manifesto', 'index.html');

// Check if source file exists
if (!fs.existsSync(sourcePath)) {
  console.error(`Error: Source file not found at ${sourcePath}`);
  console.error('Please export your Google Doc as .docx and save it as "manifesto.docx" in the manifesto folder.');
  process.exit(1);
}

// Configure Mammoth options
const options = {
  styleMap: [
    "p[style-name='Title'] => h1:fresh",
    "p[style-name='Heading 1'] => h2:fresh",
    "p[style-name='Heading 2'] => h3:fresh",
    "p[style-name='Heading 3'] => h4:fresh",
    "p[style-name='Quote'] => blockquote:fresh"
  ],
  convertImage: mammoth.images.imgElement(function(image) {
    return image.read("base64").then(function(imageBuffer) {
      // Mammoth expects an object with src attribute
      // If we want to essentially "hide" it, we can return a tiny blank image or try to return null?
      // Returning null might crash it.
      // Let's return a valid but empty structure, and we filter it out later.
      return {
        src: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        class: "remove-me" 
      };
    });
  })
};

// Better approach to ignore images: use a custom converter that returns an empty string?
// Mammoth options: convertImage: mammoth.images.inline(function(element) { ... })
// If we pass a function that just returns Promise.resolve(), it might work.

// Let's rely on regex cleanup for simplicity and robustness if we want to fully remove the <img> tag.
// But to avoid processing large base64 data, we can define a converter that does nothing.
// options.convertImage = () => Promise.resolve({}); // This caused the crash.

mammoth.convertToHtml({ path: sourcePath }, options)
  .then(function(result) {
    let htmlContent = result.value; // The generated HTML
    
    // 1. Remove any empty <img> tags or images we suppressed
    // We marked them with class "remove-me" or just standard img tags
    htmlContent = htmlContent.replace(/<img[^>]*class="remove-me"[^>]*>/g, '');
    htmlContent = htmlContent.replace(/<img[^>]*>/g, ''); // Remove ALL images from DOCX as requested

    // 2. Insert banner.png at the top
    // The banner should be at the very top of the article content.
    // Let's put it before the first element.
    const bannerHtml = '<img src="banner.png" alt="Banner" style="width: 100%; height: auto; display: block; margin: 0 auto 30px;">\n';
    
    // Find the first <h1> to put the banner *after* it, or *before*?
    // User said "place banner.png on the top of the page".
    // Usually a banner goes before the title or immediately after.
    // The previous HTML had <h1>Manifesto...</h1> then <img ...>.
    // Let's assume user wants it as a hero image, maybe above title?
    // "banner.png on the top of the page".
    // Let's prepend it to the whole content.
    htmlContent = bannerHtml + htmlContent;

    // 3. Fix Footnotes
    // Check if there are footnotes (Mammoth usually outputs them as an <ol> at the end)
    // We'll look for the last <ol> and wrap it if it seems to be footnotes.
    // A simple heuristic is if it ends with </ol> and contains footnote refs.
    
    if (htmlContent.trim().endsWith('</ol>')) {
        const lastOlIndex = htmlContent.lastIndexOf('<ol>');
        if (lastOlIndex !== -1) {
            const footnotesContent = htmlContent.substring(lastOlIndex);
            // Check if it looks like footnotes (e.g. has footnote-ref links)
            // Mammoth footnotes usually have id="footnote-1"
            if (footnotesContent.includes('footnote-') || footnotesContent.includes('↑')) {
                const beforeFootnotes = htmlContent.substring(0, lastOlIndex);
                htmlContent = beforeFootnotes + 
                              '<div class="citations">\n<h2>References</h2>\n' + 
                              footnotesContent + 
                              '\n</div>';
            }
        }
    } else {
        // Fallback: search for <ol> that contains footnotes anywhere near the end
        // Sometimes Mammoth puts extra whitespace or tags.
        const matches = htmlContent.match(/<ol>[\s\S]*?<\/ol>\s*$/);
        if (matches) {
           const footnotesContent = matches[0];
           if (footnotesContent.includes('footnote-') || footnotesContent.includes('↑')) {
               htmlContent = htmlContent.replace(footnotesContent, 
                              '<div class="citations">\n<h2>References</h2>\n' + 
                              footnotesContent + 
                              '\n</div>');
           }
        }
    }
    
    const messages = result.messages; // Any warnings

    if (messages.length > 0) {
      console.log('Conversion warnings:', messages);
    }

    // Read existing index.html
    let indexHtml = fs.readFileSync(indexPath, 'utf8');
    
    // Inject Content
    // We look for <article>...</article> and replace content
    const articleRegex = /<article>[\s\S]*?<\/article>/;
    const newArticle = `<article>\n${htmlContent}\n</article>`;
    
    if (articleRegex.test(indexHtml)) {
        indexHtml = indexHtml.replace(articleRegex, newArticle);
    } else {
        console.error('Could not find <article> tag in index.html');
        process.exit(1);
    }

    // Clean up old manual citations if they exist, because Mammoth handles footnotes differently.
    // Mammoth typically outputs footnotes at the bottom of the HTML value automatically if they exist in the doc.
    // However, Mammoth puts them in a section with id="doc-footnotes" or similar.
    // We might need to styling for that.
    
    // For now, let's remove any existing manual .citations block since we're overwriting from DOCX
    const citationsRegex = /<div class="citations">[\s\S]*?<\/div>/;
    indexHtml = indexHtml.replace(citationsRegex, '');
    
    // Also remove the "References" header if we added it manually in the previous script,
    // though the previous script put it inside the .citations div, so the regex above handles it.

    fs.writeFileSync(indexPath, indexHtml);
    console.log('Successfully updated manifesto/index.html from manifesto.docx');
  })
  .catch(function(error) {
    console.error('Error converting DOCX:', error);
    process.exit(1);
  });
