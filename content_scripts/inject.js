var head = document.getElementsByTagName('head')[0];
var libScript = document.createElement('script');
var detectScript = document.createElement('script');
detectScript.src = browser.runtime.getURL('content_scripts/detect.js');

head.appendChild(detectScript);

const url1 = browser.runtime.getURL('data/origin.json');
const url2 = browser.runtime.getURL('data/unique_v_dict.json');
const url3 = browser.runtime.getURL('data/subtrees_index.json');
const url4 = browser.runtime.getURL('data/subtrees.json');
  
/**
 * Listen for messages from the background script.
 * Call "insertBeast()" or "removeExistingBeasts()".
 */
browser.runtime.onMessage.addListener((message) => {
    if (message.command === "genTree") {
        window.postMessage({type: 'genTree', url: url1}, "*")
        console.log('send message 1.')
    }
    else if (message.command === "analTree") {
        window.postMessage({type: 'analTree', url: url2}, "*")
        console.log('send message 2.')
    }
    else if (message.command === "detect") {
        window.postMessage({type: 'detect', urls: [url1, url3, url4]}, "*")
        console.log('send message 3.')
    }
    else {
        console.log('Other Message.')
    }
});

  