chrome.runtime.onInstalled.addListener(() => {
	chrome.storage.local.set({ siteUrl: 'https://yourusername.github.io/jitori' });
});

chrome.action.onClicked.addListener(async (tab) => {
	if (!tab.id) return;

	try {
		await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: startScreenshotCapture
		});
	} catch (error) {
		console.error('Failed to start screenshot capture:', error);
	}
});

function startScreenshotCapture() {
	if (window.jitoriCaptureActive) return;
	window.jitoriCaptureActive = true;

	const overlay = document.createElement('div');
	overlay.id = 'jitori-overlay';
	overlay.style.cssText = `
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		cursor: crosshair;
		z-index: 2147483647;
	`;

	const selection = document.createElement('div');
	selection.id = 'jitori-selection';
	selection.style.cssText = `
		position: absolute;
		border: 2px solid #3b82f6;
		background: rgba(59, 130, 246, 0.2);
		display: none;
	`;

	overlay.appendChild(selection);
	document.body.appendChild(overlay);

	let isSelecting = false;
	let startX = 0;
	let startY = 0;

	function getCoordinates(e) {
		return {
			x: e.clientX,
			y: e.clientY
		};
	}

	overlay.addEventListener('mousedown', (e) => {
		isSelecting = true;
		const coords = getCoordinates(e);
		startX = coords.x;
		startY = coords.y;

		selection.style.left = startX + 'px';
		selection.style.top = startY + 'px';
		selection.style.width = '0px';
		selection.style.height = '0px';
		selection.style.display = 'block';
	});

	overlay.addEventListener('mousemove', (e) => {
		if (!isSelecting) return;

		const coords = getCoordinates(e);
		const left = Math.min(startX, coords.x);
		const top = Math.min(startY, coords.y);
		const width = Math.abs(coords.x - startX);
		const height = Math.abs(coords.y - startY);

		selection.style.left = left + 'px';
		selection.style.top = top + 'px';
		selection.style.width = width + 'px';
		selection.style.height = height + 'px';
	});

	overlay.addEventListener('mouseup', async () => {
		if (!isSelecting) return;
		isSelecting = false;

		const rect = selection.getBoundingClientRect();
		if (rect.width < 10 || rect.height < 10) {
			cleanup();
			return;
		}

		try {
			const dataUrl = await captureScreenArea(rect);
			await openJitoriSite(dataUrl);
		} catch (error) {
			console.error('Capture failed:', error);
			alert('Failed to capture screenshot. Please try again.');
		}

		cleanup();
	});

	function cleanup() {
		overlay.remove();
		window.jitoriCaptureActive = false;
	}

	async function captureScreenArea(rect) {
		return new Promise((resolve, reject) => {
			chrome.runtime.sendMessage(
				{ action: 'capture', rect },
				(response) => {
					if (chrome.runtime.lastError) {
						reject(chrome.runtime.lastError);
					} else if (response.error) {
						reject(new Error(response.error));
					} else {
						resolve(response.dataUrl);
					}
				}
			);
		});
	}

	async function openJitoriSite(imageData) {
		const { siteUrl } = await chrome.storage.local.get('siteUrl');
		const encodedImage = encodeURIComponent(imageData);
		const url = `${siteUrl}?image=${encodedImage}`;
		window.open(url, '_blank');
	}

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			cleanup();
		}
	}, { once: true });
}
