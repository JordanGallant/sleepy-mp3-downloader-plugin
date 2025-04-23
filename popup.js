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
  
  // gets progress form service worker (4)
  port.onMessage.addListener((message) => {
    if (message.type === "progress") {
      // Update progress
      progressElement.textContent = `${message.percent}%`;
      chrome.storage.local.set({ percent: message.percent });
    } 
    //gets titles from service worker (6)
    else if (message.type === "titles") {

      // default
      titlesContainer.innerHTML = "";

      //reverse array so most recent is first
      const reversedTitles = message.titles.reverse();

      
      // create elements for each titles
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