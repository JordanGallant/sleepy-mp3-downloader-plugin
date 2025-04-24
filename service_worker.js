// In service_worker.js
let latestProgress = "0.00";
let id = "";
let evtSource;
let titles = null;
let popupConnected = false;
let popupPort = null;

// see if popup is open
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup") {
    popupConnected = true;
    popupPort = port;

    // send titles to popup
    if (titles) {
      port.postMessage({
        type: "titles",
        titles: titles
      });
    }

    // sends progress to popup
    if (latestProgress) {
      port.postMessage({
        type: "progress",
        percent: latestProgress
      });
    }

    // disconnect -> popup is closed
    port.onDisconnect.addListener(() => {
      popupConnected = false;
      popupPort = null;
    });
  }
});

// recieves Id from content.js (2)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setId") {
    id = request.id;
    console.log("Received id:", id);

    //live progress feed from api endpoint
    evtSource = new EventSource(`https://audio-api-6r6z.onrender.com/progress?id=${id}`);

    //get progress percentage
    evtSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      latestProgress = data.percent;

      // send to popup.js if loaded (3)
      if (popupConnected && popupPort) {
        popupPort.postMessage({
          type: "progress",
          percent: latestProgress
        });
      }
      //check if progress is 95 and stops -> otherwise it keeps looking and cries to find nothing there (bitchass)
      if (parseFloat(latestProgress) >= 95) {
        evtSource.close();
        console.log("EventSource connection closed as progress reached 95%");
      }
    };
  }
  // Gets titles from content.js(4)
  if (request.action === "sendTitles") {
    titles = request.titles;

    //  sends titles to popup.js (5)
    if (popupConnected && popupPort) {
      popupPort.postMessage({
        type: "titles",
        titles: titles
      });
    }
    chrome.action.openPopup()
    // Log titles for debugging
    console.log("Received titles:", titles);
  }

});

