/**
 * Client-side PDF text extraction using pdfjs-dist.
 * Dynamically imported so it only loads when the user actually uploads a PDF.
 */
export async function extractPdfText(file: File): Promise<string> {
	try {
		const pdfjsLib = await import('pdfjs-dist');

		// Point worker to CDN to avoid Vite bundling issues
		pdfjsLib.GlobalWorkerOptions.workerSrc =
			`https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

		const buffer = await file.arrayBuffer();
		const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

		const texts: string[] = [];
		for (let i = 1; i <= pdf.numPages; i++) {
			const page = await pdf.getPage(i);
			const content = await page.getTextContent();
			const pageText = content.items
				.filter((item: unknown): item is { str: string } =>
					typeof item === 'object' && item !== null && 'str' in item
				)
				.map((item) => item.str)
				.join(' ');
			if (pageText.trim()) texts.push(pageText.trim());
		}

		const result = texts.join('\n\n').trim();
		return result || '[PDF uploaded but no extractable text found. Please paste the relevant content.]';
	} catch (e) {
		console.error('PDF text extraction failed:', e);
		return '[PDF text extraction failed. Please paste the relevant content as text.]';
	}
}
