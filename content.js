const createDownloadButton = () => {
    const btn = document.createElement('button');
    btn.innerText = 'Download';
    btn.className = 'my-sc-download-btn';
    btn.style.marginLeft = '10px';
    btn.style.background = 'orange';
    btn.style.color = 'white';
    btn.style.padding = '5px';
    btn.onclick = () => {
      const url = window.location.href;
      console.log("url:" , url)
      chrome.runtime.sendMessage({ action: 'download', url });
    };
    return btn;
  };
  
  const addDownloadButton = () => {
    const targets = document.querySelectorAll('.trackItem, .sound__soundActions, .systemPlaylistBannerItem, .listenEngagement__footer');
  
    targets.forEach(target => {
      if (target.querySelector('.my-sc-download-btn')) return;
  
      const btn = createDownloadButton();
      target.appendChild(btn);
    });
  };
  
  setInterval(addDownloadButton, 3000);
  