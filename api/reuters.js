
const REUTERS_TOKEN = "**REMOVED**"
const REUTERS_API = `http://rmb.reuters.com/rmd/rest/json/search?mediaType=T&language=en&sort=score&token=${REUTERS_TOKEN}`
const REUTERS_ITEM_API = `http://rmb.reuters.com/rmd/rest/json/item?token=${REUTERS_TOKEN}`

const leadingZero = (num) => {
  return ("0" + num).slice(-2)
}

const searchReutersArticleByKeywordAndDate = (blueMixKeywords, date) => {
  const req = new XMLHttpRequest();
  let query = "-headline:schedule||body:";
  let dateRange = null;
  let orgDate = null;
  if(date && date.toString() != "Invalid Date") {
    orgDate = new Date(date);
    date.setDate(date.getDate() - 5)
    //console.log(orgDate)
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
    //console.log(dateRange)
  }

  blueMixKeywords.forEach(function(keyword) {
    if (keyword.relevance >= 0.4) {
      if (query !== "-headline:schedule||body:") {
        query += " AND "
      }
      if (keyword.text.search(/ |-/)) {
        //console.log(keyword.text)
        query += "(" + keyword.text.split(/ |-/).join(" OR ") + ")"
      } else {
        //console.log(keyword.text)
        query += keyword.text
      }
    }
  });
  if(query === "-headline:schedule||body:") {
    console.error('No relevant keywords', blueMixKeywords);
    return;
  }
  console.log('Querying reuters article search', blueMixKeywords, query);

  let reutersApiCall = REUTERS_API + '&q=' + encodeURIComponent(query.replace(/[\u2018\u2019]/g, '').replace(/\[]-+\/()~^!|:,&'"{}\\/g, escape));
  if(dateRange) reutersApiCall += `&dateRange=${dateRange}`;
  //console.log(reutersApiCall)
  req.open("GET", reutersApiCall, false)
  req.send();

  var reutersInfo = JSON.parse(req.responseText);
  //console.log(reutersInfo)

  if(!reutersInfo || !reutersInfo.results) {
    console.error('Incorrect Reuters response', req.responseText);
    return -1;
  }

  // tries again if -1
  if(reutersInfo.results.numFound == 0) {
      return -1;
  }

  reutersInfo.results.result.forEach((article) => {
    //console.log(article.headline)
  });

  if(!orgDate) return reutersInfo.results.result[0].id;
  
  // get article id with the smallest time difference to dateCreated
  let minTimeDiff = Math.abs(orgDate.getTime() - reutersInfo.results.result[0].dateTime);
  let minId = reutersInfo.results.result[0].id;
  /*reutersInfo.results.result.forEach((article) => {
    if (Math.abs(article.dateCreated - orgDate.getTime()) < minTimeDiff) {
      minTimeDiff = Math.abs(article.dateCreated - orgDate.getTime());
      minId = article.id
    }
  });*/
  return minId;
}
