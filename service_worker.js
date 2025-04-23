let latestProgress = "0.00";
let id = ""; 
let evtSource;
let latestTrackInfo = null; // Cache track info

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setId") {
    id = request.id;
    console.log("Received id:", id);

    evtSource = new EventSource(`https://audio-api-6r6z.onrender.com/progress?id=${id}`);
    
    evtSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      latestProgress = data.percent;

      chrome.runtime.sendMessage({
        type: "progress",
        percent: latestProgress
      });

      if (parseFloat(latestProgress) >= 95) {
        evtSource.close();
        console.log("EventSource connection closed as progress reached 95%");
      }
    };
  }

  if (request.action === "addToPopup") { //stores variables in background
    latestTrackInfo = {
      title: request.title,
      artist: request.artist,
    };
    chrome.action.openPopup();
  }
  //sends response back to popup with data 
  if (request.action === "getPopupData") {
    sendResponse({
      title: latestTrackInfo?.title || "N/A",
      artist: latestTrackInfo?.artist || "N/A",
      percent: latestProgress,
    });
  }

  return true; // Keep sendResponse valid for async use if needed
});
