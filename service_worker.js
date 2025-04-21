// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//     if (message.action === 'download') {
//       const url = message.url;
//       // Do something with the URL, like trigger a download
//       chrome.downloads.download({
//         url: url,
//         filename: 'track.mp3', // optional
//         saveAs: true // prompts user
//       });
//     }
//   });