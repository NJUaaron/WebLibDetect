

function sendCmd(cmd) {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs)=>{
        browser.tabs.sendMessage(tabs[0].id, {
            command: cmd
        });
    })

}

function listenForClicks() {
    document.addEventListener("click", (e) => {
        console.log('listenforclick!')
        switch (e.target.id) {
            case "gt_btn":
                return sendCmd('genTree')
            case "at_btn":
                return sendCmd('analTree')
            case "dt_btn":
                return sendCmd('detect')
        }
    }
)}

function reportExecuteScriptError(error) {
    console.error(`Failed to execute beastify content script: ${error.message}`);
  }

/**
* When the popup loads, inject a content script into the active tab,
* and add a click handler.
* If we couldn't inject the script, handle the error.
*/
// browser.tabs
//     .executeScript({ file: "/content_scripts/inject.js" })
//     .then(listenForClicks)
//     .catch(reportExecuteScriptError);

listenForClicks()