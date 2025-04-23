let latestProgress = "0.00";

// Start SSE connection
const evtSource = new EventSource("https://audio-api-6r6z.onrender.com/progress");

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
