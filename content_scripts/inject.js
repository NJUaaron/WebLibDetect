var head = document.getElementsByTagName('head')[0];
var libScript = document.createElement('script');
var detectScript = document.createElement('script');
detectScript.src = chrome.runtime.getURL('content_scripts/detect.js');

head.appendChild(detectScript);

const url1 = chrome.runtime.getURL('data/origin.json');
const url2 = chrome.runtime.getURL('data/unique_v_dict.json');
const url3 = chrome.runtime.getURL('data/subtrees_index.json');
const url4 = chrome.runtime.getURL('data/subtrees.json');
  
/**
 * Listen for messages from the background script.
 * Call "insertBeast()" or "removeExistingBeasts()".
 */
chrome.runtime.onMessage.addListener((message) => {
    if (message.command === "detect") {
        window.postMessage({type: 'detect', urls: [url1, url3, url4]}, "*")
        console.log('send message <detect>.')
    }
    else {
        console.log('Other Message.')
    }
});

  