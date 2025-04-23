document.addEventListener("DOMContentLoaded", () => {
  const progressContainer = document.getElementById("track-progress");
  const titlesContainer = document.getElementById("titles-container");

  // Create progress element
  const progressElement = document.createElement("p");
  progressElement.id = "progress-text";
  progressElement.textContent = "0%";
  progressContainer.appendChild(progressElement);

  // Connect to the service worker
  const port = chrome.runtime.connect({name: "popup"});
  
  // Listen for messages from service worker
  port.onMessage.addListener((message) => {
    if (message.type === "progress") {
      // Update progress
      progressElement.textContent = `${message.percent}%`;
      chrome.storage.local.set({ percent: message.percent });
    } 
    else if (message.type === "titles") {
  
  
      
      // Clear existing titles first
      titlesContainer.innerHTML = "";

      //reverse array so most recent is first
      const reversedTitles = message.titles.reverse();

      
      // Create elements for each title and add to container
      reversedTitles.forEach((title) => {
        const titleElement = document.createElement("p");
        titleElement.textContent = title;
        titleElement.className = "track-title";
        titlesContainer.appendChild(titleElement);
      });
    }
  });

  // Check if there's a stored progress value to display
  chrome.storage.local.get("percent", (data) => {
    if (data.percent) {
      progressElement.textContent = `${data.percent}%`;
    }
  });
});