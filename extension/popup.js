document.addEventListener('DOMContentLoaded', async () => {
	const captureBtn = document.getElementById('capture-btn');
	const siteUrlInput = document.getElementById('site-url');
	const saveBtn = document.getElementById('save-btn');
	const statusDiv = document.getElementById('status');

	const { siteUrl } = await chrome.storage.local.get('siteUrl');
	if (siteUrl) {
		siteUrlInput.value = siteUrl;
	}

	captureBtn.addEventListener('click', async () => {
		try {
			const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
			if (tab.id) {
				await chrome.scripting.executeScript({
					target: { tabId: tab.id },
					func: () => {
						if (window.jitoriCaptureActive) return;
						
						const script = document.createElement('script');
						script.src = chrome.runtime.getURL('content.js');
						script.onload = () => {
							script.remove();
							startScreenshotCapture();
						};
						document.head.appendChild(script);
					}
				});
			}
			window.close();
		} catch (error) {
			showStatus('Failed to start capture: ' + error.message, false);
		}
	});

	saveBtn.addEventListener('click', async () => {
		const url = siteUrlInput.value.trim();
		if (url) {
			await chrome.storage.local.set({ siteUrl: url });
			showStatus('Settings saved!', true);
		}
	});

	function showStatus(message, success) {
		statusDiv.textContent = message;
		statusDiv.className = 'status ' + (success ? 'success' : '');
		setTimeout(() => {
			statusDiv.className = 'status';
		}, 3000);
	}
});
