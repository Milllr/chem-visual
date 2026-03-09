/** Compress an image file to WebP for R2 upload */
export async function compressImage(file: File, maxDim = 1200, quality = 0.82): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement('canvas');
			let { width, height } = img;

			if (width > maxDim || height > maxDim) {
				if (width > height) {
					height = (height * maxDim) / width;
					width = maxDim;
				} else {
					width = (width * maxDim) / height;
					height = maxDim;
				}
			}

			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d')!;
			ctx.drawImage(img, 0, 0, width, height);
			canvas.toBlob(
				(blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
				'image/webp',
				quality
			);
		};
		img.onerror = reject;
		img.src = URL.createObjectURL(file);
	});
}
