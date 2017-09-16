var OPEN_CALAIS_TAGGING = "https://api.thomsonreuters.com/permid/calais"

var BLUEMIX_NLP =
  "https://gateway.watsonplatform.net/natural-language-understanding/api/v1/analyze?version=2017-02-27"

var REUTERS_API = "http://rmb.reuters.com/rmd/rest/json/search?mediaType=T&language=de&token=0Uar2fCpykWL+Yi+Q9MFJlBqVn4owE8q81kIX5wuiTI=&sort=score&dateRange=2017.09.15.00.00&q=body%3A"

var user = "***REMOVED***";
var pass = "***REMOVED***"

function sendToBackend(text) {
  var req = new XMLHttpRequest();

  console.log('Making request to', url);

  const payload = {
    text,
    features: {
      concepts: {
        "emotion": true,
        "sentiment": true,
        "limit": 3
      },
      categories: {
        "emotion": true,
        "sentiment": true,
        "limit": 3
      },
      keywords: {
        "emotion": true,
        "sentiment": true,
        "limit": 3
      }
    }
  }
  req.open("POST", BLUEMIX_NLP, false);
  req.setRequestHeader("Authorization", "Basic " + btoa(user + ":" + pass));
  req.send(JSON.stringify(payload));

  console.log('res', req.responseText, '/res');
  debugger;
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
  console.log(reutersInfo)

  if(reutersInfo && reutersInfo.results.numFound > 0) {
    reutersInfo.results.result.forEach(function(result) {
      console.log(result.headline)
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
  req.open("POST", BLUEMIX_NLP, false);
  req.setRequestHeader("Authorization", "Basic " + btoa(user + ":" + pass));
  req.send(JSON.stringify(payload));
}

chrome.contextMenus.onClicked.addListener(processContextMenuClick);


chrome.runtime.onInstalled.addListener(function() {

  var contextMenuID = chrome.contextMenus.create({
      id: "newsxray_context_menu",
      title: "NewsX-Ray this text",
      contexts:["selection"]
  });
});
