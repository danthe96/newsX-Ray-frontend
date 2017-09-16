function sendToBackend(info, tab) {
  console.log(info.selectionText)
}

chrome.contextMenus.onClicked.addListener(sendToBackend);


chrome.runtime.onInstalled.addListener(function() {

  var contextMenuID = chrome.contextMenus.create({
      id: "newsxray_context_menu",
      title: "NewsX-Ray this text",
      contexts:["selection"]
  });
});
