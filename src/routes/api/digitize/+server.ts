import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Digitize handwritten/printed notes from a photo.
 * Uses GPT-4o vision to decompose a notebook page into ordered blocks:
 * - text (transcribed handwriting/print)
 * - image (diagrams, drawings, structures — returned as crop coordinates)
 * - equation (LaTeX math)
 *
 * Returns the blocks in reading order so the client can create them sequentially.
 */

interface DigitizedBlock {
	type: 'text' | 'image' | 'equation';
	content?: string; // transcribed text or LaTeX
	// Crop coordinates as percentages (0-100) of the original image
	crop?: { x: number; y: number; w: number; h: number };
	description?: string; // description for image regions
}

const DIGITIZE_PROMPT = `You are analyzing a photo of handwritten or printed notes from a chemistry lab notebook. Your job is to decompose this page into an ordered list of content blocks, preserving the reading order (top to bottom, left to right).

For each distinct region of the page, create a block entry:

1. **text** — Transcribe handwritten or printed text faithfully. Fix obvious misspellings but preserve the author's wording, notation, and formatting. Use markdown for structure (headings with #, bold with **, lists with -). Include chemical formulas inline (e.g., H₂SO₄, NaOH). If you see subscripts/superscripts, use Unicode subscript/superscript characters.

2. **equation** — For mathematical equations or chemical equations, transcribe as readable plain text. Use → for reaction arrows, = for equations. Keep it readable, not LaTeX.

3. **image** — For diagrams, sketches, structural formulas, graphs, tables, or any visual content that can't be represented as text: provide the bounding box as percentage coordinates (x, y from top-left corner, w, h as width/height — all as percentages 0-100 of the full image dimensions). Also provide a brief description.

CRITICAL RULES:
- Maintain reading order strictly — top to bottom, then left to right
- Every part of the page should be captured in some block
- For text that's next to a diagram, create separate blocks for each
- Merge consecutive text that flows naturally (same paragraph)
- Don't skip anything — if you can't read it, describe it as an image block
- Be generous with image blocks — if something is visual (arrows, circles, diagrams, chemical structures, hand-drawn anything), capture it as an image block with crop coordinates

Return ONLY valid JSON — an array of block objects:
[
  { "type": "text", "content": "transcribed text here..." },
  { "type": "image", "crop": { "x": 10, "y": 5, "w": 80, "h": 30 }, "description": "Reaction mechanism showing..." },
  { "type": "equation", "content": "2H₂ + O₂ → 2H₂O" }
]`;

export const POST: RequestHandler = async ({ request, platform }) => {
	const apiKey = platform?.env?.OPENAI_API_KEY;
	if (!apiKey) return json({ error: 'API key not configured' }, { status: 500 });

	const { imageDataUrl } = await request.json();
	if (!imageDataUrl) return json({ error: 'No image provided' }, { status: 400 });

	try {
		const res = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: 'gpt-4o',
				messages: [
					{
						role: 'system',
						content: DIGITIZE_PROMPT
					},
					{
						role: 'user',
						content: [
							{
								type: 'image_url',
								image_url: {
									url: imageDataUrl,
									detail: 'high'
								}
							},
							{
								type: 'text',
								text: 'Analyze this notebook page and decompose it into ordered content blocks. Return the JSON array.'
							}
						]
					}
				],
				max_tokens: 4096,
				temperature: 0.2
			})
		});

		if (!res.ok) {
			const err = await res.text();
			console.error('OpenAI digitize error:', err);
			return json({ error: `OpenAI API error: ${res.status}` }, { status: 500 });
		}

		const data = await res.json();
		const content = data.choices?.[0]?.message?.content;
		if (!content) {
			return json({ error: 'Empty response from model' }, { status: 500 });
		}

		// Parse JSON from response (handle markdown code blocks)
		const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
		const blocks: DigitizedBlock[] = JSON.parse(jsonStr);

		return json({ blocks });
	} catch (err) {
		console.error('Digitize error:', err);
		return json({ error: String(err) }, { status: 500 });
	}
};
