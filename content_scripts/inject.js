var head = document.getElementsByTagName('head')[0];
var libScript = document.createElement('script');
var detectScript = document.createElement('script');
detectScript.src = chrome.runtime.getURL('content_scripts/detect.js');

head.appendChild(detectScript);

const url1 = chrome.runtime.getURL('data/origin.json');
const url2 = chrome.runtime.getURL('data/pts.json');
const url3 = chrome.runtime.getURL('data/jsfile_list.json');
  
/**
 * Listen for messages from the background script.
 * Call "insertBeast()" or "removeExistingBeasts()".
 */
chrome.runtime.onMessage.addListener((message) => {
    if (message.command === "detect") {
        window.postMessage({type: 'detect', urls: [url1, url2, url3]}, "*")
        console.log('send message <detect>.')
    }
    else {
        console.log('Other Message.')
    }
});

  