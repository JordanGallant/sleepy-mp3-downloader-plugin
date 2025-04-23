// popup.js
document.addEventListener("DOMContentLoaded", () => {
    const progressElement = document.getElementById("progress-text");
  
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("📥 Popup received message:", message);
      if (message.type === "progress") {
        progressElement.textContent = `${message.percent}%`;
      }
    });
  });
  