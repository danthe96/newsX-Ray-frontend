const REUTERS_ITEM_ID_TEMP = "tag:reuters.com,2017:newsml_KCN1BR06U:3"

const REUTERS_TOKEN = "8axRu+WqZAC8yj7X9Un9Uylur7X2G8Kk81kIX5wuiTI=="
const REUTERS_API = `http://rmb.reuters.com/rmd/rest/json/search?mediaType=T&language=en&sort=score&token=${REUTERS_TOKEN}`
const REUTERS_ITEM_API = `http://rmb.reuters.com/rmd/rest/json/item?token=${REUTERS_TOKEN}`

const leadingZero = (num) => {
  return ("0" + num).slice(-2)
}

const searchReutersArticleByKeywordAndDate = (blueMixKeywords, date) => {
  const req = new XMLHttpRequest();
  let query = "body:";
  let dateRange = null;
  let orgDate = null;
  if(date) {
    orgDate = new Date(date);
    date.setDate(date.getDate() - 1)
    console.log(orgDate)
    const y = date.getFullYear();
    const m = leadingZero(date.getMonth() + 1);
    const d = leadingZero(date.getDate());
    const h = leadingZero(date.getHours());
    const min = leadingZero(date.getMinutes());
    const yo = orgDate.getFullYear();
    const mo = leadingZero(orgDate.getMonth() + 1);
    const doo = leadingZero(orgDate.getDate());
    const ho = leadingZero(orgDate.getHours());
    const mino = leadingZero(orgDate.getMinutes());
    dateRange = `${y}.${m}.${d}.${h}.${min}-${yo}.${mo}.${doo}.${ho}.${mino}`
    console.log(dateRange)
  }

  blueMixKeywords.forEach(function(keyword) {
    if (keyword.relevance >= 0.4) {
      if (query !== "body:") {
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
  if(query === "q=body%3A") {
    console.error('No relevant keywords', blueMixKeywords);
    return;
  }
  console.log('Querying reuters article search', blueMixKeywords, query);

  let reutersApiCall = REUTERS_API + '&q=' + encodeURIComponent(query);
  if(dateRange) reutersApiCall += `&dateRange=${dateRange}`;
  console.log(reutersApiCall)
  req.open("GET", reutersApiCall, false)
  req.send();

  var reutersInfo = JSON.parse(req.responseText);
  console.log(reutersInfo)

  if(!reutersInfo || !reutersInfo.results) {
    console.error('Incorrect Reuters response', req.responseText);
    return;
  }

  // tries again if -1
  if(reutersInfo.results.numFound == 0) {
      return -1;
  }

  reutersInfo.results.result.forEach((article) => {
    console.log(article.headline)
  });

  // get article id with the smallest time difference to dateCreated
  let minTimeDiff = Math.abs(orgDate.getTime() - reutersInfo.results.result[0].dateTime);
  let minId = reutersInfo.results.result[0].id;
  reutersInfo.results.result.forEach((article) => {
    if (Math.abs(article.dateCreated - orgDate.getTime()) < minTimeDiff) {
      minTimeDiff = Math.abs(article.dateCreated - orgDate.getTime());
      minId = article.id
    }
  });
  return minId;
}
