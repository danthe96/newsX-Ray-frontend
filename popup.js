import {getKeywords} from './api/bluemixNLP'
/**
 * Get the current URL.
 *
 * @param {function(string)} callback called when the URL of the current tab
 *   is found.
 */
function getCurrentTabUrl(callback) {
  // Query filter to be passed to chrome.tabs.query - see
  // https://developer.chrome.com/extensions/tabs#method-query
  var queryInfo = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.query(queryInfo, (tabs) => {
    // chrome.tabs.query invokes the callback with a list of tabs that match the
    // query. When the popup is opened, there is certainly a window and at least
    // one tab, so we can safely assume that |tabs| is a non-empty array.
    // A window can only have one active tab at a time, so the array consists of
    // exactly one tab.
    var tab = tabs[0];

    // A tab is a plain object that provides information about the tab.
    // See https://developer.chrome.com/extensions/tabs#type-Tab
    var url = tab.url;

    // tab.url is only available if the "activeTab" permission is declared.
    // If you want to see the URL of other tabs (e.g. after removing active:true
    // from |queryInfo|), then the "tabs" permission is required to see their
    // "url" properties.
    console.assert(typeof url == 'string', 'tab.url should be a string');

    callback(url);
  });

  // Most methods of the Chrome extension APIs are asynchronous. This means that
  // you CANNOT do something like this:
  //
  // var url;
  // chrome.tabs.query(queryInfo, (tabs) => {
  //   url = tabs[0].url;
  // });
  // alert(url); // Shows "undefined", because chrome.tabs.query is async.
}

const selectors = {
  "www.nytimes.com": {title: "#headline", body: "#story div.story-body > p"},
  "www.foxnews.com": {title: "#doc > div.page-content > main > section > article > header > h1", body: "#doc > div.page-content > main > section > article > div > div.article-body > p"},
  "abcnews.go.com": {title: "#article-feed > article > div > header > h1", body: "#article-feed > article:nth-child(1) > div > div.article-body > div > p"},
  "www.cbsnews.com": {title: "#article > header > h1", body: "#article-entry > div:nth-child(2) > p"},
  "www.bbc.com": {title: "#page > div > div.container > div > div.column--primary > div.story-body > h1", body: "#page > div > div.container > div > div.column--primary > div.story-body > div.story-body__inner > p"}
}
/**
 *
 */
function extractText(host, callback) {
  const selector = selectors[host].body;

  const extractor = (selector) => {
    const nodes = Array.prototype.slice.call(document.querySelectorAll(selector));
    console.log('nodes', nodes);
    return nodes.map(p=>p.textContent);
  };

  const script = `(${extractor.toString()})('${selector}')`;
  chrome.tabs.executeScript({
    code: script
  }, callback);
}

function hostForUrl(urlString) {
  const url = new URL(urlString);
  return url.hostname;
}

function highlightText(text, transparency, altText) {
  const replacer = (text, transparency, altText) => {
    const tooltipHtml = altText ? `data-balloon="${altText}" data-balloon-pos="up" data-balloon-length="xlarge"` : "";
    const leading = `<span style="background-color: rgba(255, 187, 0, ${transparency})" ${tooltipHtml}>`;
    const trailing = "</span>";
    // world-class replacement logic right here
    const threshold = 17;
    const leadingText = text.slice(0, threshold);
    const trailingText = text.slice(-threshold);
    document.body.innerHTML = document.body.innerHTML.replace(leadingText, leading+leadingText);
    document.body.innerHTML = document.body.innerHTML.replace(trailingText, trailingText+trailing);
  };
  const script = `(${replacer.toString()})("${text.replace('"', '\\"').replace('\'', '\\\'')}", ${transparency}, "${altText}")`;
  chrome.tabs.executeScript({
    code: script
  }, null);
}

function appendOmittedText(paragraphs, selectorForArticleParagraphs) {
  if(paragraphs.length == 0) {
    return;
  }
  const appender = (paragraphs, selector) => {
    const nodes = document.querySelectorAll(selector);
    const last = nodes[nodes.length - 1];
    console.log(last);
    const parent = last.parentNode;

    const h1 = document.createElement("h1");
    h1.className = "xray-omissions-title"
    h1.appendChild(document.createTextNode("Omitted text"));
    parent.appendChild(h1);

    const quote = document.createElement("blockquote");
    paragraphs.forEach(text=>{
      const p = document.createElement("p");
      p.appendChild(document.createTextNode(text));
      quote.appendChild(p);
    });
    parent.appendChild(quote);
  };

  const code = `(${appender.toString()})(${JSON.stringify(paragraphs)}, "${selectorForArticleParagraphs}")`;
  console.log(code);
  chrome.tabs.executeScript({code});
}

function showProgressText(text) {
  const node = document.getElementById("progressInfo");
  node.innerText = text;
}
let host = null;
function sendToBackend(result) {
  const paragraphs = result[0];   // no idea
  if(paragraphs.length > 0){
      document.getElementById('notInArticleNotice').style.display = 'none';
      document.getElementById('defaultIcon').style.display = 'none';
      showSpinner();
  } else {
    document.getElementById('defaultIcon').style.display = '';
    document.getElementById('notInArticleNotice').style.display = 'block';
  }
  const textJoined = paragraphs.join(" ").replace("\n", " ");
  console.log(chrome.extension.getBackgroundPage());
  chrome.extension.getBackgroundPage().sendToBackend(textJoined, result => {
    console.log('final result', result);
    result.matched_sentences.forEach(r=>highlightText(r.news_sentence, r.score, r.reuters_sentence));
    appendOmittedText(result.omitted_sentences, selectors[host]);
    hideSpinner();
  });
};

document.addEventListener('DOMContentLoaded', () => {
  getCurrentTabUrl((url) => {
    host = hostForUrl(url);
    if(host in selectors) {
      document.getElementById('unsupportedNotice').style.display = 'none';
      extractText(host, sendToBackend);
    } else {
      document.getElementById('defaultIcon').style.display = '';
      document.getElementById('unsupportedNotice').style.display = 'block';
    }

  });

  // test
  const colorButton = document.getElementById('colorize-test');
  colorButton.addEventListener('click', () => {
    highlightText('headquarters', 0.9, 'Think differentThink differentThink differentThink differentThink different');
  });
});
