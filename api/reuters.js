const REUTERS_ITEM_ID_TEMP = "tag:reuters.com,2017:newsml_KCN1BR06U:3"

const REUTERS_TOKEN = "***REMOVED***"
const REUTERS_API = `http://rmb.reuters.com/rmd/rest/json/search?mediaType=T&language=en&token=${REUTERS_TOKEN}&sort=score&dateRange=2017.09.15.00.00&q=body%3A`
const REUTERS_ITEM_API = `http://rmb.reuters.com/rmd/rest/json/item?token=${REUTERS_TOKEN}`

const searchReutersArticleByKeywordAndDate = (blueMixKeywords, date) => {
  const req = new XMLHttpRequest();
  let query = ""

  blueMixKeywords.forEach(function(keyword) {
    if (keyword.relevance >= 0.4) {
      if (query !== "") {
        query += " AND "
      }
      if (keyword.text.search(/ |-/)) {
        console.log(keyword.text)
        query += keyword.text.split(/ |-/).join(" AND ")
      } else {
        console.log(keyword.text)
        query += keyword.text
      }
    }
  });
  if(!query) {
    console.error('No relevant keywords', blueMixKeywords);
    reportProgress('done:No relevant keywords');
    return null;
  }
  console.log('Querying reuters article search', blueMixKeywords, query);

  reutersApiCall = REUTERS_API + encodeURIComponent(query)
  req.open("GET", reutersApiCall, false)
  req.send();

  var reutersInfo = JSON.parse(req.responseText);
  console.log(reutersInfo);
  return reutersInfo;
}
