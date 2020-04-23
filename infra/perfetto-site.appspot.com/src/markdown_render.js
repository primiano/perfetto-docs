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

function assertNoDeadLink(relPathFromRoot) {
  relPathFromRoot = relPathFromRoot.replace(/\#.*$/g, '');  // Remove #line.
  const fullPath = path.join(ROOT_DIR, relPathFromRoot);
  if (!fs.existsSync(fullPath)) {
    const msg = `Dead link: ${relPathFromRoot}`;
    console.error(msg);
    throw new Error(msg);
  }
}

function renderHeading(text, level) {
  // If the heading has an explicit ${#anchor}, use that. Otherwise infer the
  // anchor from the text but only for h2 and h3. Note the right-hand-side TOC
  // is dynamically generated from anchors (explicit or implicit).
  let anchorId = '';
  const explicitAnchor = /{#([\w-_.]+)}/.exec(text);
  if (explicitAnchor) {
    text = text.replace(explicitAnchor[0], '');
    anchorId = explicitAnchor[1];
  } else if (level >= 2 && level <= 3) {
    anchorId = text.toLowerCase().replace(/[^\w]+/g, '-');
    anchorId = anchorId.replace(/[-]+/g, '-');  // Drop consecutive '-'s.
  }
  let anchor = '';
  if (anchorId) {
    anchor = `<a name="${anchorId}" class="anchor" href="#${anchorId}"></a>`;
  }
  return `<h${level}>${anchor}${text}</h${level}>`;
}

function renderLink(originalLinkFn, href, title, text) {
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
  return originalLinkFn(href, title, text);
}

function renderCode(text, lang) {
  let hlHtml = '';
  if (lang) {
    hlHtml = hljs.highlight(lang, text).value
  } else {
    hlHtml = hljs.highlightAuto(text).value
  }
  return `<code class="hljs code-block">${hlHtml}</code>`
}

function render(rawMarkdown) {
  const renderer = new marked.Renderer();
  const originalLinkFn = renderer.link.bind(renderer);
  renderer.link = (hr, ti, te) => renderLink(originalLinkFn, hr, ti, te);
  renderer.code = renderCode;
  renderer.heading = renderHeading;
  return marked(rawMarkdown, {renderer: renderer});
}

function main() {
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
    markdownHtml = render(fs.readFileSync(inFile, 'utf8'));
  }

  if (templateFile) {
    // TODO rename nav.html to sitemap or something more mainstream.
    const navFilePath = path.join(outDir, 'docs', '_nav.html');
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
}

main();