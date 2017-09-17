const BLUEMIX_NLP =
  "https://gateway.watsonplatform.net/natural-language-understanding/api/v1/analyze?version=2017-02-27"

const user = "***REMOVED***";
const pass = "***REMOVED***";

function makeBluemixRequest(payload) {
  const req = new XMLHttpRequest();

  //console.log('Making request to', BLUEMIX_NLP);

  req.open("POST", BLUEMIX_NLP, false);
  req.setRequestHeader("Content-type", "application/json");
  req.setRequestHeader("Authorization", "Basic " + btoa(user + ":" + pass));
  req.send(JSON.stringify(payload));

  var bluemixNLP = JSON.parse(req.responseText);
  //console.log('Got Bluemix NLP answer', bluemixNLP);
  return bluemixNLP;
}

const getKeywords = (text) => {
    const payload = {
      text,
      "features": {
        "keywords": {}
      }
    };
    return makeBluemixRequest(payload).keywords;
  };

const getSentimentsAndEmotion = (text) => {
    const payload = {
      text,
      "features": {
        "sentiment": {},
        "emotion": {},
      }
    };
    return makeBluemixRequest(payload);
}
