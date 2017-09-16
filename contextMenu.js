var OPEN_CALAIS_TAGGING = "https://api.thomsonreuters.com/permid/calais"

var BLUEMIX_NLP =
  "https://gateway.watsonplatform.net/natural-language-understanding/api/v1/analyze?version=2017-02-27"

const REUTERS_ITEM_ID_TEMP = "tag:reuters.com,2017:newsml_KCN1BR06U:3"

const REUTERS_TOKEN = "***REMOVED***"
const REUTERS_API = `http://rmb.reuters.com/rmd/rest/json/search?mediaType=T&language=de&token=${REUTERS_TOKEN}&sort=score&dateRange=2017.09.15.00.00&q=body%3A`
const REUTERS_ITEM_API = `http://rmb.reuters.com/rmd/rest/json/item?token=${REUTERS_TOKEN}`

var user = "***REMOVED***";
var pass = "***REMOVED***"

function sendToBackend(text, callback) {
  var req = new XMLHttpRequest();

  console.log('Making request to', BLUEMIX_NLP);

  const payload = {
    text,
    "features": {
      "entities": {
        "emotion": true,
        "sentiment": true
      },
      "keywords": {
        "emotion": true,
        "sentiment": true
      },
      "concepts": {},
      "emotion": {},
      "sentiment": {},
      "categories":{},

    }
  };
  req.open("POST", BLUEMIX_NLP, false);
  req.setRequestHeader("Content-type", "application/json");
  req.setRequestHeader("Authorization", "Basic " + btoa(user + ":" + pass));
  req.send(JSON.stringify(payload));

  var bluemixNLP = JSON.parse(req.responseText);
  console.log(bluemixNLP)

  var keywords = "";
  console.log(bluemixNLP.entities);

  bluemixNLP.entities.forEach(function(keyword) {
    if (keyword.relevance >= 0.2) {
      if (keyword.text.search(/ |-|=/)) {
        console.log(keyword.text)
        keywords += '"' + keyword.text + '"' + " AND "
      } else {
        console.log(keyword.text)
        keywords += keyword.text + " AND "
      }
    }
  });
  keywords = keywords.slice(0, -5);

  req = new XMLHttpRequest();
  reutersApiCall = REUTERS_API + encodeURIComponent(keywords)
  req.open("GET", reutersApiCall, false)
  req.send();

  var reutersInfo = JSON.parse(req.responseText);
  console.log(reutersInfo);

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

function processContextMenuClick(info) {
  const text = info.selectionText;
  console.log(text);
  sendToBackend(text);
}

function sendToOpenCalais(text) {
  var payload = {
    text: text
  };
  req = new XMLHttpRequest();
  req.open("POST", OPEN_CALAIS_TAGGING, false);
  req.setRequestHeader("outputFormat", "application/json");
  req.setRequestHeader("x-ag-access-token", "***REMOVED***");
  req.send(JSON.stringify(payload));

  var openCalaisInfo = JSON.parse(req.responseText);
  console.log(openCalaisInfo);

  Object.keys(openCalaisInfo).forEach((key) => {
    if (key !== 'doc' && openCalaisInfo[key]._typeGroup === "entities") {
      console.log(openCalaisInfo[key].name, openCalaisInfo[key])
    }
  });
}

chrome.contextMenus.onClicked.addListener(processContextMenuClick);


chrome.runtime.onInstalled.addListener(function() {

  var contextMenuID = chrome.contextMenus.create({
      id: "newsxray_context_menu",
      title: "NewsX-Ray this text",
      contexts:["selection"]
  });
});
