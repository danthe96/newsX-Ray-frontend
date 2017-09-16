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
    "www.nytimes.com": {
        title: "#headline",
        body: "#story div.story-body > p",
    },
    "www.foxnews.com": {
        title: "#doc > div.page-content > main > section > article > header > h1",
        body: "#doc > div.page-content > main > section > article > div > div.article-body > p",
    },
    "abcnews.go.com": {
        title: "#article-feed > article > div > header > h1",
        body: "#article-feed > article:nth-child(1) > div > div.article-body > div > p",
        date: 'head > meta[name^="Last-Modified"]',
        dateParser: node => node.attributes["content"].textContent
    },
    "theguardian.com": {
        title: "",
        body: "",
        date: "time"
    }
};
/**
 *
 */
function extractText(host, callback) {
  const selector = selectors[host];

  const extractor = (selectorString) => {
    const selector = JSON.parse(selectorString);
    const nodes = Array.prototype.slice.call(document.querySelectorAll(selector.body));
    console.log('nodes', nodes);
    const paragraphs = nodes.map(p=>p.textContent);
    const title = document.querySelector(selector.title).textContent;
    const dateNode = document.querySelector(selector.date || "time");
    const date = selector.dateParser ? selector.dateParser(dateNode) : dateNode.attributes["datetime"].textContent;
    return {paragraphs, title, date};
  };

  const script = `(${extractor.toString()})('${JSON.stringify(selector)}')`;
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
    quote.className = "xRay-omitted";
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
function startAnalysis(result) {
  const {paragraphs, title, date} = result[0];   // no idea
  debugger;
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
  sendToBackend(textJoined, title, date, result => {
    console.log('final result', result);
    result.matched_sentences.forEach(r=>highlightText(r.news_sentence, r.score, r.reuters_sentence));
    appendOmittedText(result.omitted_sentences, selectors[host]);
    hideSpinner();
  });
};

function sendToBackend(text, title, date, callback) {

  var blueMixKeywords = getKeywords(title.replace(/ [^a-zA-Z ]|[^a-zA-Z ] /g, " "))
  console.log(blueMixKeywords)

  const reutersInfo = searchReutersArticleByKeywordAndDate(blueMixKeywords, date)
  console.log(reutersInfo)

  if(reutersInfo && reutersInfo.results.numFound > 0) {
    reutersInfo.results.result.forEach(function(result) {
      console.log(result.headline);

      req = new XMLHttpRequest();
      reutersApiCall = REUTERS_ITEM_API + `&id=${REUTERS_ITEM_ID_TEMP}`
      req.open("GET", reutersApiCall, false)
      req.send();

      const reutersArticle = JSON.parse(req.responseText);

      console.log('reutersArticle', reutersArticle);
      reuters_text = reutersArticle.body_xhtml;

      chrome.tabs.query({
        active: true,
        currentWindow: true
      }, function(tabs) {
        var tab = tabs[0];
        const url = new URL(tab.url);
        const source = url.hostname;

        req = new XMLHttpRequest();
        var backendUrl = 'http://172.30.7.156:8000';
        req.open("POST", backendUrl, false);
        req.setRequestHeader("Content-type", "application/json");
        req.send(JSON.stringify({
          'reuters_id': REUTERS_ITEM_ID_TEMP,
          'source': source,
          'reuters': reuters_text,
          'news': text
        }));
        const result = JSON.parse(req.responseText);
        if(callback) callback(result); else console.log(result);
      });
      // query end
    });
  } else {
    console.log("Reuters did not return anything")
  }
}

document.addEventListener('DOMContentLoaded', () => {
  getCurrentTabUrl((url) => {
    host = hostForUrl(url);
    if(host in selectors) {
      document.getElementById('unsupportedNotice').style.display = 'none';
      extractText(host, startAnalysis);
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
