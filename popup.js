document.addEventListener("DOMContentLoaded", () => {
  const progressElement = document.getElementById("progress-text");
  const trackData = document.getElementById("track-data");

  chrome.runtime.sendMessage({ action: "getPopupData" }, (response) => {
    if (response) {
      progressElement.textContent = `${response.percent}%`;
      trackData.textContent = `Now Downloading: ${response.title} by ${response.artist}`;
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "progress") {
      progressElement.textContent = `${message.percent}%`;
    }
  });
});
