// In service_worker.js
let latestProgress = "0.00";
let id = ""; 
let evtSource;
let titles = null;
let popupConnected = false;
let popupPort = null;

// track connections of the popup
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup") {
    popupConnected = true;
    popupPort = port;
    
    // send titles immediately
    if (titles) {
      port.postMessage({
        type: "titles",
        titles: titles
      });
    }
    
    // Send current progress if available
    if (latestProgress) {
      port.postMessage({
        type: "progress",
        percent: latestProgress
      });
    }
    
    // Handle disconnect
    port.onDisconnect.addListener(() => {
      popupConnected = false;
      popupPort = null;
    });
  }
});

// recieves Id from content
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setId") {
    id = request.id;
    console.log("Received id:", id);

    evtSource = new EventSource(`https://audio-api-6r6z.onrender.com/progress?id=${id}`);
    
    evtSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      latestProgress = data.percent;
      
      // Only send if popup is connected
      if (popupConnected && popupPort) {
        popupPort.postMessage({
          type: "progress",
          percent: latestProgress
        });
      }
      
      if (parseFloat(latestProgress) >= 95) {
        evtSource.close();
        console.log("EventSource connection closed as progress reached 95%");
      }
    };
  }
  
  if (request.action === "sendTitles") {
    titles = request.titles;
    
    // Only send if popup is connected
    if (popupConnected && popupPort) {
      popupPort.postMessage({
        type: "titles",
        titles: titles
      });
    }
    
    // Log titles for debugging
    console.log("Received titles:", titles);
  }
});