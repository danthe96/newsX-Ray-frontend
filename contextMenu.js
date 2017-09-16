var BLUEMIX_NLP =
  "https://gateway.watsonplatform.net/natural-language-understanding/api/v1/analyze?version=2017-02-27&features=concepts,categories,emotion,keywords,sentiment&text="

var REUTERS_API = "http://rmb.reuters.com/rmd/rest/json/search?mediaType=T&language=en&token=0Uar2fCpykWL+Yi+Q9MFJlBqVn4owE8q81kIX5wuiTI=&dateRange=2017.09.16.00.00&q=body%3A"

var user = "***REMOVED***";
var pass = "***REMOVED***"

function sendToBackend(info, tab) {
  console.log(info.selectionText)
  var req = new XMLHttpRequest();

  req.open("GET", BLUEMIX_NLP + info.selectionText, false);
  req.setRequestHeader("Authorization", "Basic " + btoa(user + ":" + pass));
  req.send();

  var bluemixNLP = JSON.parse(req.responseText);
  console.log(bluemixNLP)

  var keywords = "";
  console.log(bluemixNLP.keywords);

  bluemixNLP.keywords.forEach(function(keyword) {
    console.log(keyword.text.split(/ |-|=/))
    keyword.text.split(/ |-|=/).forEach(function(word){

      keywords += word + " OR "
    })
  });
  keywords = keywords.slice(0, -4);

  req = new XMLHttpRequest();
  reutersApiCall = REUTERS_API + encodeURIComponent(keywords)
  req.open("GET", reutersApiCall, false)
  req.send();

  var reutersInfo = JSON.parse(req.responseText);
  console.log(reutersInfo)

  reutersInfo.results.result.forEach(function(result) {
    console.log(result.headline)
  });

}

chrome.contextMenus.onClicked.addListener(sendToBackend);


chrome.runtime.onInstalled.addListener(function() {

  var contextMenuID = chrome.contextMenus.create({
      id: "newsxray_context_menu",
      title: "NewsX-Ray this text",
      contexts:["selection"]
  });
});
