function startSpinning() {
    document.getElementById('loadingIndicator').style.display = 'block';
    document.getElementById('notInArticleNotice').style.display = 'none';
    document.getElementById('defaultIcon').style.display = 'none';
}
function stopSpinning() {
    document.getElementById('loadingIndicator').style.display = 'none';
    document.getElementById('defaultIcon').style.display = '';
}

function reportProgress(text) {
    const node = document.getElementById("progressInfo");
    if(text.slice(0, 5)=="done:") {
        node.innerText = text.slice(5);
        stopSpinning();
    } else node.innerText = text;
}