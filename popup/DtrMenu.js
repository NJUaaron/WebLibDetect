

function sendCmd(cmd) {
    chrome.tabs.query({ currentWindow: true, active: true }, (tabs)=>{
        chrome.tabs.sendMessage(tabs[0].id, {
            command: cmd
        });
    });

}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("dt_btn").addEventListener("click", () => sendCmd("detect"));
});

// function listenForClicks() {
//     document.addEventListener("click", (e) => {
//         console.log('listenforclick!')
//         switch (e.target.id) {
//             case "gt_btn":
//                 return sendCmd('genTree')
//             case "at_btn":
//                 return sendCmd('analTree')
//             case "dt_btn":
//                 return sendCmd('detect')
//         }
//     }
// )}

// function reportExecuteScriptError(error) {
//     console.error(`Failed to execute beastify content script: ${error.message}`);
//   }

/**
* When the popup loads, inject a content script into the active tab,
* and add a click handler.
* If we couldn't inject the script, handle the error.
*/

