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
        body: "#article-feed > article:nth-child(2) > div > div.article-body > div > p",
        //date: 'head > meta[name^=\"Last-Modified\"]',
        //dateParser: node => node.attributes["content"].textContent
    },
    "www.theguardian.com": {
        title: "#article > div.hide-on-mobile > header > div.content__header.tonal__header > div > div > h1",
        body: "#article > div > div > div > div.js-article__body > p",
    },
    "www.wsj.com": {
      title: "#bigTopBox > div > div > h1",
      body: "#wsj-article-wrap > p",
      //date: "head > meta[name^=article.published]",
      //dateParser: node => node.attributes["content"].textContent
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
    const date = selector.dateParser ? selector.dateParser(dateNode) : (dateNode.attributes["datetime"] || {}).textContent;
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

function highlightText(text, transparency, altText, esc = false) {
  const replacer = (text, transparency, altText, esc) => {
    const tooltipHtml = altText ? `data-balloon="${esc ? unescape(altText) : altText}" data-balloon-pos="up" data-balloon-length="xlarge"` : "";
    const leading = `<span style="background-color: rgba(255, 187, 0, ${transparency})" ${tooltipHtml}>`;
    const trailing = "</span>";
    // world-class replacement logic right here
    const threshold = 7;
    const leadingText = text.slice(0, threshold);
    const trailingText = text.slice(-threshold);
    if(document.body.innerHTML.indexOf(leadingText)==-1 || document.body.innerHTML.indexOf(trailingText)==-1) {
      console.error('Couldn\'t match text to highlight', leadingText, trailingText);
    }
    document.body.innerHTML = document.body.innerHTML.replace(leadingText, leading+leadingText);
    document.body.innerHTML = document.body.innerHTML.replace(trailingText, trailingText+trailing);
  };
  const script = `(${replacer.toString()})(${JSON.stringify(text)}, ${transparency}, ${JSON.stringify(altText)}, ${esc})`;
  chrome.tabs.executeScript({
    code: script
  }, null);
}

function appendSentimentAnalysis(newsAdditions, selectorForArticleParagraphs){
  if(newsAdditions.length == 0){
    return;
  }

  results = getSentimentsAndEmotion(newsAdditions.join(' '));
  var sentimentScore = results["sentiment"]["document"]["score"];
  var sentimentText = `The information added by the newspaper is fairly neutral.`;
  const emotions = results["emotion"]["document"]["emotion"];
  const maxEmotion = Object.keys(emotions).reduce(function(a, b){ return emotions[a] > emotions[b] ? a : b });

  chrome.storage.sync.get({"sentimentStats": {}}, (items) => {
      if(!(host in items["sentimentStats"])){
        items["sentimentStats"][host] = {
            "sentimentScoreSum": 0,
            "emotions":{
              "sadness": 0,
              "joy": 0,
              "fear": 0,
              "disgust": 0,
              "anger": 0
            },
            "counter": 0
        }
      }

      statistics = items["sentimentStats"][host]
      statistics["sentimentScoreSum"] += sentimentScore
      statistics["emotions"]["sadness"] += emotions["sadness"]
      statistics["emotions"]["joy"] += emotions["joy"]
      statistics["emotions"]["fear"] += emotions["fear"]
      statistics["emotions"]["disgust"] += emotions["disgust"]
      statistics["emotions"]["anger"] += emotions["anger"]
      statistics["counter"] += 1

      avg_sentiment = statistics["sentimentScoreSum"] / statistics["counter"];

      chrome.storage.sync.set({'sentimentStats': items["sentimentStats"]}, () => {

        const maxPastEmotion = Object.keys(statistics["emotions"]).reduce(function(a, b){ return statistics["emotions"][a] > statistics["emotions"][b] ? a : b });
        if(sentimentScore < -0.4){
          sentimentText = `The information added or the views expressed by the newspaper are very negative, mostly characterized by ${maxEmotion}.`
        } else if(sentimentScore < -0.1){
          sentimentText = `The information added or the views expressed by the newspaper are mostly negative.`
        } else if(sentimentScore > 0.4){
          sentimentText = `The information added or the views expressed by the newspaper are very positive, mostly characterized by ${maxEmotion}.`
        } else if (sentimentScore > 0.1){
          sentimentText = `The information added or the views expressed by the newspaper are mostly positive.`
        }

        if(sentimentScore < -0.4){
          sentimentText += `\n Articles by ` + host + ` have been very negative in the past, characterized by ${maxPastEmotion}.`
        } else if(sentimentScore < -0.1){
          sentimentText += `\n Articles by ` + host + ` have been mostly negative in the past.`
        } else if(sentimentScore > 0.4){
          sentimentText += `\n Articles by ` + host + ` have been very positive in the past, characterized by ${maxPastEmotion}.`
        } else if (sentimentScore > 0.1){
          sentimentText += `\n Articles by ` + host + ` have been mostly positive in the past.`
        } else {
          sentimentText += `\n Articles by ` + host + ` have been very neutral in the past.`
        }

        const appender = (sentimentText, selector) => {
          const nodes = document.querySelectorAll(selector);
          const last = nodes[nodes.length - 1];
          const parent = last.parentNode;

          const sentimentElement = document.createElement("h2");
          sentimentElement.appendChild(document.createTextNode(sentimentText));
          parent.appendChild(sentimentElement);
        };

        const code = `(${appender.toString()})(${JSON.stringify(sentimentText)}, "${selectorForArticleParagraphs}")`;
        chrome.tabs.executeScript({code});

      });
  });
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
  chrome.tabs.executeScript({code});
}

function prepareArticleForHighlighting() {
  const mainNode = document.querySelector(selectors[host].body).parent;
  mainNode.innerHTML = mainNode.innerHTML.replace(/(<a[^>]*>)|(<\/a>)/g, "");
}

let host = null;

function startAnalysis(result) {
  if(!(result[0] || []).paragraphs) console.error('Expected array with object', result);
  const {paragraphs, title, date} = result[0];   // no idea
  console.assert(date);
  console.assert(title);
  console.log(`Starting analysis on ${paragraphs.length} paragraphs`);
  if(paragraphs.length > 0){
      startSpinning();
      reportProgress('Analyzing...');
      const textJoined = paragraphs.join(" ").replace("\n", " ");
      sendToBackend(textJoined, title, date, result => {
        console.log('final result', result);
        prepareArticleForHighlighting();
        result.matched_sentences.forEach(r => {
            console.log('r', r);
            highlightText(r.news_sentence, r.score, `Similarity: ${100*r.score}%, Original sentence: ${escape(r.reuters_sentence)}`, true);
        });
        appendSentimentAnalysis(result.news_additions, selectors[host].body);
        appendOmittedText(result.omitted_sentences, selectors[host].body);
        stopSpinning();
      });
  } else {
    document.getElementById('defaultIcon').style.display = '';
    document.getElementById('notInArticleNotice').style.display = 'block';
  }
};

function sendToBackend(text, title, dateStr, callback) {
  var blueMixKeywords = getKeywords(title.replace(/ [^a-zA-Z ]|[^a-zA-Z ] /g, " "))
  console.log(blueMixKeywords)
  const date = new Date(dateStr)
  searchMatchingReutersArticles(blueMixKeywords, callback, -1, date, text);
}

function searchMatchingReutersArticles(keywords, callback, leaveOut, date, text) {
  if(leaveOut==keywords.length) {
    console.error('No more combinations to try out');
    reportProgress('done:No matching article found');
    return;
  }
  const filteredKeywords = keywords.filter((value, index)=>index!=leaveOut);
  const articleId = searchReutersArticleByKeywordAndDate(filteredKeywords, date);

  if(articleId === -1) {
      console.log("Reuters did not return anything, trying again");
      return searchMatchingReutersArticles(keywords, callback, leaveOut + 1, date, text);
  }

  continueDownloadingReutersArticle(articleId, callback, text);
}

function continueDownloadingReutersArticle(articleId, callback, text) {
    req = new XMLHttpRequest();
    reutersApiCall = REUTERS_ITEM_API + `&id=${articleId}`
    req.open("GET", reutersApiCall, false)
    req.send();

    const reutersArticle = JSON.parse(req.responseText);

    console.log('reutersArticle', reutersArticle);
    reuters_text = reutersArticle.body_xhtml;

    finalRequest(text, reuters_text, reutersArticle.versionedguid, callback);
}

function finalRequest(text, reuters_text, reutersId, callback) {
  reportProgress('Comparing article with Reuters match');
  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, function(tabs) {
    var tab = tabs[0];
    const url = new URL(tab.url);
    const sourceId = url.hostname;

    req = new XMLHttpRequest();
    var backendUrl = 'http://172.30.7.156:8000';
    const params = {
      'reuters_id': reutersId,
      'source': sourceId,
      'reuters': reuters_text,
      'news': text
    };
    req.open("POST", backendUrl, false);
    req.setRequestHeader("Content-type", "application/json");
    console.log('sending final request', params);
    try {
      req.send(JSON.stringify(params));
    } catch (error) {
      reportProgress('done:An error occurred');
      console.error(error);
    }
    const result = JSON.parse(req.responseText);
    reportProgress('done:Analysis complete!');
    if(callback) callback(result);
    else console.error('no callback specified', result);
  });
  // query end
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
