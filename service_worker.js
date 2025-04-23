let latestProgress = "0.00";
let id = ""; 

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "setId") {
    id = request.id;  // update the id from client
    console.log("Received id:", id);

    // Start SSE connection with the updated id
    evtSource = new EventSource(`https://audio-api-6r6z.onrender.com/progress?id=${id}`);
    
    evtSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      latestProgress = data.percent;
      console.log("Received progress:", data.percent);

      // Broadcast to all popup listeners
      chrome.runtime.sendMessage({
        type: "progress",
        percent: latestProgress
      });
    };

    evtSource.onerror = (err) => {
      console.error("SSE error:", err);
    };
  }

  if (request.action === "showPopup") {
    chrome.action.openPopup(); // This opens the popup
  }
});
