document.addEventListener("DOMContentLoaded", () => {
  const progressContainer = document.getElementById("track-progress");
  const titlesContainer = document.getElementById("titles-container");

  // create progress element
  const progressElement = document.createElement("p");
  progressElement.id = "progress-text";
  progressElement.textContent = "0%";
  progressContainer.appendChild(progressElement);

  // connect to the service worker -> sees if popup is showing
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

      
      // create elements for each title
      reversedTitles.forEach((title) => {
        const titleElement = document.createElement("p");
        titleElement.textContent = title;
        titleElement.className = "track-title";
        titlesContainer.appendChild(titleElement);
      });
    }
  });

  // gets progress from local storage (flex)
  chrome.storage.local.get("percent", (data) => {
    if (data.percent) {
      progressElement.textContent = `${data.percent}%`;
    }
  });
});