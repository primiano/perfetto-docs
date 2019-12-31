// Copyright (C) 2020 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const ejs = require('ejs');
const marked = require('marked');
const argv = require('yargs').argv
const fs = require('fs-extra');
const path = require('path');
const hljs = require('highlight.js');

const GITHUB_BASE_URL = 'https://github.com/google/perfetto/blob/master';
const ROOT_DIR = path.dirname(path.dirname(path.dirname(__dirname)));


function hrefInDocs(href) {
  if (href.startsWith('/docs/')) {
    return href;
  }
  if (href.match(/^[a-z]/g) && !href.match(/^https?:/g)) {
    return '/docs/' + href;
  }
  return undefined;
}

const renderer = new marked.Renderer();
renderer.heading = (text, level) => {
  if (level < 2 || level > 3) {
    return `<h${level}>${text}</h${level}>`
  }
  let escapedText = text.toLowerCase().replace(/[^\w]+/g, '-');
  escapedText = escapedText.replace(/[-]+/g, '-');  // Drop consecutive '-'s.
  return `<h${level}>
            <a name="${escapedText}" class="anchor" href="#${escapedText}"></a>
            ${text}
          </h${level}>`;
};

function assertNoDeadLink(relPathFromRoot) {
  relPathFromRoot = relPathFromRoot.replace(/\#.*$/g, '');  // Remove #line.
  const fullPath = path.join(ROOT_DIR, relPathFromRoot);
  if (!fs.existsSync(fullPath)) {
    const msg = `Dead link: ${relPathFromRoot}`;
    console.error(msg);
    throw new Error(msg);
  }
}

const markedLink = renderer.link.bind(renderer);
renderer.link = (href, title, text) => {
  const docsHref = hrefInDocs(href);
  let sourceCodeLink = undefined;
  if (docsHref !== undefined) {
    href = docsHref.replace(/.md$/g, '');
  } else if (href.startsWith('../')) {
    // ../tools/xxx -> github/tools/xxx.
    sourceCodeLink = href.substr(2);
  } else if (href.startsWith('/') && !href.startsWith('//')) {
    // /tools/xxx -> github/tools/xxx.
    sourceCodeLink = href;
  }
  if (sourceCodeLink !== undefined) {
    // Fix up line anchors for GitHub link: #42 -> #L42.
    sourceCodeLink = sourceCodeLink.replace(/#(\d+)$/g, '#L$1')
    assertNoDeadLink(sourceCodeLink);
    href = GITHUB_BASE_URL + sourceCodeLink;
  }
  return markedLink(href, title, text);
};

const markedImage = renderer.image.bind(renderer);
renderer.image = (href, title, text) => {
  const docsHref = hrefInDocs(href);
  if (docsHref !== undefined) {
    const outFile = outDir + docsHref;
    const outParDir = path.dirname(outFile);
    fs.ensureDirSync(outParDir);
    fs.copyFileSync(ROOT_DIR + docsHref, outFile);
  }
  return markedImage(href, title, text);
};

renderer.code = (text, lang) => {
  let hlHtml = '';
  if (lang) {
    hlHtml = hljs.highlight(lang, text).value
  } else {
    hlHtml = hljs.highlightAuto(text).value
  }
  return `<code class="hljs code-block">${hlHtml}</code>`
};

const inFile = argv['i'];
const outFile = argv['o'];
const outDir = argv['odir'];
const templateFile = argv['t'];
if (!outFile || !outDir) {
  console.error('Usage: --odir site -o out.html [-i input.md] [-t templ.html]');
  process.exit(1);
}

let markdownHtml = '';
if (inFile) {
  const rawMarkdown = fs.readFileSync(inFile, 'utf8');
  markdownHtml = marked(rawMarkdown, {renderer: renderer});
}

if (templateFile) {
  // TODO rename nav.html to sitemap or something more mainstream.
  const navFilePath = path.join(path.dirname(outFile), '_nav.html');
  const templateData = {
    markdown: markdownHtml,
    fileName: '/' + outFile.split('/').slice(1).join('/'),
  };
  if (fs.existsSync(navFilePath)) {
    templateData['nav'] = fs.readFileSync(navFilePath, 'utf8');
  }
  ejs.renderFile(templateFile, templateData, (err, html) => {
    if (err)
      throw err;
    fs.writeFileSync(outFile, html);
    process.exit(0);
  });
} else {
  fs.writeFileSync(outFile, markdownHtml);
  process.exit(0);
}
