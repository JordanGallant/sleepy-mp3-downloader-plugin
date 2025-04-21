chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'download') {
      console.log("Download requested:", message.trackTitle);
      chrome.downloads.download({
        url: message.downloadUrl,
        saveAs: true
      });
    }
  });