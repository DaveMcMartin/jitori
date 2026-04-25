chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === 'capture') {
		captureVisibleTab(request.rect)
			.then(dataUrl => sendResponse({ dataUrl }))
			.catch(error => sendResponse({ error: error.message }));
		return true;
	}
});

async function captureVisibleTab(rect) {
	try {
		const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });

		return await cropImage(dataUrl, rect);
	} catch (error) {
		throw new Error(`Capture failed: ${error.message}`);
	}
}

function cropImage(dataUrl, rect) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');

			if (!ctx) {
				reject(new Error('Failed to get canvas context'));
				return;
			}

			const scaleX = img.width / window.innerWidth;
			const scaleY = img.height / window.innerHeight;

			const sourceX = rect.left * scaleX;
			const sourceY = rect.top * scaleY;
			const sourceWidth = rect.width * scaleX;
			const sourceHeight = rect.height * scaleY;

			canvas.width = sourceWidth;
			canvas.height = sourceHeight;

			ctx.drawImage(
				img,
				sourceX,
				sourceY,
				sourceWidth,
				sourceHeight,
				0,
				0,
				sourceWidth,
				sourceHeight
			);

			resolve(canvas.toDataURL('image/png'));
		};
		img.onerror = () => reject(new Error('Failed to load captured image'));
		img.src = dataUrl;
	});
}
