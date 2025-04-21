const createDownloadButton = (trackElement) => {
    const btn = document.createElement('button');
    btn.innerText = 'Download';
    btn.className = 'my-sc-download-btn';
    btn.style.marginLeft = '10px';
    btn.style.background = 'orange';
    btn.style.color = 'white';
    btn.style.padding = '5px';
    btn.onclick = () => {
        btn.innerText = 'Processing...';
        btn.disabled = true;
        const CLIENT_ID = "client_id=EjkRJG0BLNEZquRiPZYdNtJdyGtTuHdp"
        const API_URL = "https://api-v2.soundcloud.com/resolve?url=";
        let endUrl = "";
        let downloadUrl = ""
        let trackUrl = 'No URL found';

        if (trackElement.classList.contains('trackItem')) {
            const trackLink = trackElement.querySelector('.trackItem__trackTitle');
            trackUrl = trackLink ? trackLink.href : trackUrl;
        } else if (trackElement.classList.contains('listenEngagement__footer')) {
            trackUrl = window.location.href;
        } else if (trackElement.classList.contains('.systemPlaylistBannerItem')) {
            const trackLink = trackElement.querySelector('.selectionPlaylistBanner__artworkLink');
            trackUrl = trackLink ? trackLink.href : trackUrl;
        }
        endUrl = API_URL + trackUrl + "&" + CLIENT_ID

        fetch(endUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                downloadUrl = data.media.transcodings[3].url + "?" + CLIENT_ID
                trackTitle = JSON.stringify(data.title + ".mp3")


                fetch(downloadUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.log("link:", data.url)
                        fetch(data.url)
                            .then(response => response.blob())
                            .then(blob => {
                                const blobUrl = URL.createObjectURL(blob);
                                console.log(blobUrl)
                                const filename = `${trackTitle}.mp3`;
                                const a = document.createElement('a');
                                a.href = blobUrl;
                                a.download = filename;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(blobUrl);
                            })
                            .catch(err => console.error("Download failed:", err));

                    })
                    .catch(error => {
                        console.error('Error fetching data:', error);
                    });

            })
            .catch(error => {
                console.error('Error fetching data:', error);
            });
    };

    return btn;
};



const addDownloadButton = () => {
    const targets = document.querySelectorAll('.trackItem, .sound__soundActions, .systemPlaylistBannerItem, .listenEngagement__footer');

    targets.forEach(target => {
        if (target.querySelector('.my-sc-download-btn')) return;

        const btn = createDownloadButton(target);
        target.appendChild(btn);
    });
};

setInterval(addDownloadButton, 3000);
