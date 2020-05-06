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

'use strict';

let tocAnchors = [];
let lastMouseOffY = 0;

function setupSandwichMenu() {
  const header = document.querySelector('.site-header');
  const docsNav = document.querySelector('.nav');
  const menu = header.querySelector('.menu');
  menu.addEventListener('click', () => {
    // If we are displaying any /docs, toggle the navbar instead (the TOC).
    if (docsNav) {
      // |after_first_click| is to avoid spurious transitions on page load.
      docsNav.classList.add('after_first_click');
      setTimeout(() => docsNav.classList.toggle('expanded'), 0);
    } else {
      header.classList.toggle('expanded');
    }
  });
}

// (Re-)Generates the Table Of Contents for docs (the right-hand-side one).
function updateTOC() {
  if (document.body.scrollHeight < 10000) {
    document.documentElement.style.scrollBehavior = 'smooth';
  } else {
    document.documentElement.style.scrollBehavior = 'initial';
  }

  const tocContainer = document.querySelector('.docs .toc');
  if (!tocContainer)
    return;
  const toc = document.createElement('ul');
  const anchors = document.querySelectorAll('.doc a.anchor');
  tocAnchors = [];
  for (const anchor of anchors) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.innerText = anchor.parentElement.innerText;
    link.href = anchor.href;
    li.appendChild(link);
    if (anchor.parentElement.tagName === 'H3')
      li.style.paddingLeft = '10px';
    toc.appendChild(li);
    tocAnchors.push(
        {top: anchor.offsetTop + anchor.offsetHeight / 2, obj: link});
  }
  tocContainer.innerHTML = '';
  tocContainer.appendChild(toc);
}

// Highlights the current TOC anchor depending on the scroll offset.
function onMouseMove(offY, e) {
  lastMouseOffY = e.clientY - offY;
  onScroll();
}

function onScroll() {
  const y = document.documentElement.scrollTop + lastMouseOffY;
  let highEl = undefined;
  for (const x of tocAnchors) {
    if (y < x.top)
      continue;
    highEl = x.obj;
  }
  for (const link of document.querySelectorAll('.docs .toc a')) {
    if (link === highEl) {
      link.classList.add('highlighted');
    } else {
      link.classList.remove('highlighted');
    }
  }
}

function setupNav() {
  const curDoc = document.querySelector('.doc');
  let curFileName = '';
  if (curDoc)
    curFileName = curDoc.dataset['mdFile'];
  const exps = document.querySelectorAll('.docs .nav ul a');
  for (const x of exps) {
    // If the url of the entry matches the url of the page, mark the item as
    // highlighted and expand all its parents.
    const url = new URL(x.href);
    if (x.href.endsWith('#')) {
      // This is a non-leaf link to a menu.
      x.parentElement.classList.add('intermediate-menu');
    } else if (!x.href.endsWith('#') && url.pathname === curFileName) {
      x.classList.add('selected');
      for (let par = x.parentElement; par; par = par.parentElement) {
        if (par.tagName.toUpperCase() !== 'LI')
          continue;
        par.classList.add('expanded');
      }
    }

    // Add custom click handler to toggle collaps/expand of non-leaf entries.
    if (x.href.endsWith('#')) {
      x.addEventListener('click', (evt) => {
        x.parentElement.classList.toggle('expanded');
        evt.preventDefault();
      });
    }
  }
}

// If the page contains a ```mermaid ``` block, lazily loads the plugin and
// renders.
function initMermaid() {
  const graphs = document.querySelectorAll('.mermaid');

  // Skip if there are no mermaid graphs to render.
  if (!graphs.length) return;

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = '/assets/mermaid.min.js';
  script.addEventListener('load', () => {
    console.log('loaded');
    mermaid.initialize({startOnLoad:false, theme: 'forest' });
    for (const graph of graphs) {
      mermaid.init(undefined, graph);
      graph.classList.add('rendered');
    }
  })
  document.body.appendChild(script);
}

window.addEventListener('load', () => {
  setupSandwichMenu();
  setupNav();
  updateTOC();
  initMermaid();

  const doc = document.querySelector('.doc');
  const passive = {passive: true};
  if (doc) {
    const offY = doc.offsetTop;
    doc.addEventListener('mousemove', (e) => onMouseMove(offY, e), passive);
    doc.addEventListener('mouseleave', () => {
      lastMouseOffY = 0;
    }, passive);
  }
  window.addEventListener('scroll', () => onScroll(), passive);
  window.addEventListener('resize', updateTOC, passive);
});
