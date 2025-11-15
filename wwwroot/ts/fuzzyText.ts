/**
 * fuzzyText.js
 * @fileoverview Canvas-based text distortion effect
 * @description Handles text distortion effect on any element containing text
 */

type FuzzyTextOptions = {
	fontSize?: string | number;
	fontWeight?: number | string | 'inherit';
	fontFamily?: string | 'inherit';
	color?: string | null;
	enableHover?: boolean;
	baseIntensity?: number;
	hoverIntensity?: number;
	fuzzRange?: number;
};

const defaultOptions: Required<FuzzyTextOptions> = {
	fontSize: 'clamp(2rem, 10vw, 10rem)',
	fontWeight: 'inherit',
	fontFamily: 'inherit',
	color: null,
	enableHover: true,
	baseIntensity: 0.18,
	hoverIntensity: 0.5,
	fuzzRange: 30
};

//==============================================================================================
/**
 * Compute numeric font size from font size string
 * @function computeNumericFontSize
 * @param {string | number} fontSize - The font size string or number
 * @returns {number} The numeric font size
 */
function computeNumericFontSize(fontSize: string | number): number {
	if (typeof fontSize === 'number') {
		return fontSize;
	}
	const temp = document.createElement('span');
	temp.style.fontSize = fontSize;
	temp.style.position = 'absolute';
	temp.style.visibility = 'hidden';
	temp.style.whiteSpace = 'nowrap';
	document.body.appendChild(temp);
	const computedSize = window.getComputedStyle(temp).fontSize;
	const numericFontSize = parseFloat(computedSize);
	document.body.removeChild(temp);
	return Number.isFinite(numericFontSize) ? numericFontSize : 16;
}

//==============================================================================================
/**
 * Convert font weight, size, and family to a font string
 * @function toFontString
 * @param {string | number} fontWeight - The font weight
 * @param {string} fontSizeStr - The font size string
 * @param {string} fontFamily - The font family
 */
function toFontString(fontWeight: string | number, fontSizeStr: string, fontFamily: string): string {
	return `${fontWeight} ${fontSizeStr} ${fontFamily}`;
}

//==============================================================================================
/**
 * Get text from element
 * @function getTextFromElement
 * @param {HTMLElement} element - The element to get text from
 * @returns {string} The text from the element
 */
function getTextFromElement(element: HTMLElement): string {
	const text = (element.textContent || '').trim();
	return text.length ? text : element.getAttribute('data-text') || '';
}

//==============================================================================================
/**
 * Fuzzy text animator
 * @class FuzzyTextAnimator
 * @param {HTMLElement} targetElement - The element to animate
 * @param {FuzzyTextOptions} userOptions - The user options
 */
class FuzzyTextAnimator {
	private targetElement: HTMLElement;
	private options: Required<FuzzyTextOptions>;
	private animationFrameId: number;
	private isCancelled: boolean;
	private isHovering: boolean;
	public canvas: HTMLCanvasElement;
	private offscreen: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D | null;
	private offCtx: CanvasRenderingContext2D | null;
	private cleanupHandlers: Array<() => void>;

	constructor(targetElement: HTMLElement, userOptions: FuzzyTextOptions = {}) {
		this.targetElement = targetElement;
		this.options = { ...defaultOptions, ...userOptions };
		this.animationFrameId = 0;
		this.isCancelled = false;
		this.isHovering = false;
		this.canvas = document.createElement('canvas');
		this.offscreen = document.createElement('canvas');
		this.ctx = null;
		this.offCtx = null;
		this.cleanupHandlers = [];
	}

	//==============================================================================================
	/**
	 * Initialize fuzzy text animator
	 * @function init
	 * @returns {Promise<{ canvas: HTMLCanvasElement; destroy: () => void }>} resolves to canvas and destroy()
	 */
	async init(): Promise<{ canvas: HTMLCanvasElement; destroy: () => void }> {
		const element = this.targetElement;
		const text = getTextFromElement(element);
		if (!text) {
			return { canvas: this.canvas, destroy: () => this.destroy() };
		}

		// Persist original text so re-inits still have a source string
		// BT 2025-11-15: added because resizing window was breaking animation
		if (!element.getAttribute('data-text')) {
			element.setAttribute('data-text', text);
		}

		// a11y: preserve text for assistive tech
		element.setAttribute('aria-label', text);
		element.textContent = '';
		element.appendChild(this.canvas);
		this.canvas.style.display = 'block';
		this.canvas.style.maxWidth = '100%';

		// Wait for fonts if supported
		if ((document as any).fonts && (document as any).fonts.ready) {
			try {
				await (document as any).fonts.ready;
			} catch {}
		}
		if (this.isCancelled) return { canvas: this.canvas, destroy: () => this.destroy() };

		this.ctx = this.canvas.getContext('2d');
		this.offCtx = this.offscreen.getContext('2d');
		if (!this.ctx || !this.offCtx) {
			return { canvas: this.canvas, destroy: () => this.destroy() };
		}

		const computed = window.getComputedStyle(element);
		const fontFamily = this.options.fontFamily === 'inherit'
			? (computed.fontFamily || 'sans-serif')
			: this.options.fontFamily;
		const fontWeight = this.options.fontWeight === 'inherit'
			? (computed.fontWeight || 'normal')
			: this.options.fontWeight;
		const color = this.options.color || computed.color || '#fff';

		// Resolve CSS functions/relative units (i.e. clamp, vw, rem) to an explicit pixel 
		// value before using with canvas -- Safari cant parse ctx.font
		const numericFontSize = computeNumericFontSize(this.options.fontSize);
		const fontSizeStr = `${numericFontSize}px`;

		// Measure using offscreen
		this.offCtx.font = toFontString(fontWeight, fontSizeStr, fontFamily);
		this.offCtx.textBaseline = 'alphabetic';
		const metrics = this.offCtx.measureText(text) as TextMetrics & {
			actualBoundingBoxLeft?: number;
			actualBoundingBoxRight?: number;
			actualBoundingBoxAscent?: number;
			actualBoundingBoxDescent?: number;
		};
		const actualLeft = metrics.actualBoundingBoxLeft ?? 0;
		const actualRight = metrics.actualBoundingBoxRight ?? metrics.width;
		const actualAscent = metrics.actualBoundingBoxAscent ?? numericFontSize;
		const actualDescent = metrics.actualBoundingBoxDescent ?? numericFontSize * 0.2;
		const textBoundingWidth = Math.ceil(actualLeft + actualRight);
		const tightHeight = Math.ceil(actualAscent + actualDescent);
		const extraWidthBuffer = 10;
		const offscreenWidth = textBoundingWidth + extraWidthBuffer;
		const xOffset = extraWidthBuffer / 2;

		this.offscreen.width = offscreenWidth;
		this.offscreen.height = tightHeight;
		this.offCtx.font = toFontString(fontWeight, fontSizeStr, fontFamily);
		this.offCtx.textBaseline = 'alphabetic';
		this.offCtx.fillStyle = color;
		this.offCtx.clearRect(0, 0, offscreenWidth, tightHeight);
		this.offCtx.fillText(text, xOffset - actualLeft, actualAscent);

		const horizontalMargin = 50;
		const verticalMargin = 0;
		this.canvas.width = offscreenWidth + horizontalMargin * 2;
		this.canvas.height = tightHeight + verticalMargin * 2;
		this.ctx.save();
		this.ctx.translate(horizontalMargin, verticalMargin);

		const interactiveLeft = horizontalMargin + xOffset;
		const interactiveTop = verticalMargin;
		const interactiveRight = interactiveLeft + textBoundingWidth;
		const interactiveBottom = interactiveTop + tightHeight;

		const fuzzRange = this.options.fuzzRange;

		const run = () => {
			if (this.isCancelled || !this.ctx) return;
			this.ctx.clearRect(-fuzzRange, -fuzzRange, offscreenWidth + 2 * fuzzRange, tightHeight + 2 * fuzzRange);
			const intensity = (this.options.enableHover && this.isHovering)
				? this.options.hoverIntensity
				: this.options.baseIntensity;
			for (let j = 0; j < tightHeight; j++) {
				const dx = Math.floor(intensity * (Math.random() - 0.5) * fuzzRange);
				this.ctx.drawImage(this.offscreen, 0, j, offscreenWidth, 1, dx, j, offscreenWidth, 1);
			}
			this.animationFrameId = window.requestAnimationFrame(run);
		};

		run();

		const isInsideTextArea = (x: number, y: number) => {
			return x >= interactiveLeft && x <= interactiveRight && y >= interactiveTop && y <= interactiveBottom;
		};

		const handleMouseMove = (e: MouseEvent) => {
			if (!this.options.enableHover) return;
			const rect = this.canvas.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			this.isHovering = isInsideTextArea(x, y);
		};
		const handleMouseLeave = () => {
			this.isHovering = false;
		};
		const handleTouchMove = (e: TouchEvent) => {
			if (!this.options.enableHover) return;
			e.preventDefault();
			const rect = this.canvas.getBoundingClientRect();
			const touch = e.touches[0];
			const x = touch.clientX - rect.left;
			const y = touch.clientY - rect.top;
			this.isHovering = isInsideTextArea(x, y);
		};
		const handleTouchEnd = () => {
			this.isHovering = false;
		};

		if (this.options.enableHover) {
			this.canvas.addEventListener('mousemove', handleMouseMove);
			this.canvas.addEventListener('mouseleave', handleMouseLeave);
			this.canvas.addEventListener('touchmove', handleTouchMove as any, { passive: false } as any);
			this.canvas.addEventListener('touchend', handleTouchEnd as any);
			this.cleanupHandlers.push(() => {
				this.canvas.removeEventListener('mousemove', handleMouseMove);
				this.canvas.removeEventListener('mouseleave', handleMouseLeave);
				this.canvas.removeEventListener('touchmove', handleTouchMove as any);
				this.canvas.removeEventListener('touchend', handleTouchEnd as any);
			});
		}

		// Rebuild on resize
		const handleResize = () => {
			this.destroy({ keepCanvas: true });
			if (!this.canvas.parentElement) {
				element.appendChild(this.canvas);
			}
			this.isCancelled = false;
			this.init();
		};
		window.addEventListener('resize', handleResize);
		this.cleanupHandlers.push(() => window.removeEventListener('resize', handleResize));

		return { canvas: this.canvas, destroy: () => this.destroy() };
	}

	//==============================================================================================
	/**
	 * Destroy fuzzy text animator
	 * @function destroy
	 * @param {object} opts - The options
	 * @param {boolean} opts.keepCanvas - Whether to keep the canvas
	 */
	destroy(opts: { keepCanvas?: boolean } = { keepCanvas: false }) {
		this.isCancelled = true;
		if (this.animationFrameId) {
			window.cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = 0;
		}
		this.cleanupHandlers.forEach(fn => {
			try { fn(); } catch {}
		});
		this.cleanupHandlers = [];
		if (!opts.keepCanvas && this.canvas && this.canvas.parentElement) {
			this.canvas.parentElement.removeChild(this.canvas);
		}
		this.ctx = null;
		this.offCtx = null;
	}
}

//==============================================================================================
/**
 * Attach fuzzy text to element
 * @function attachFuzzyTextToElement
 * @param {HTMLElement} element - The element to attach fuzzy text to
 * @param {FuzzyTextOptions} options - The options
 */
export function attachFuzzyTextToElement(element: HTMLElement, options: FuzzyTextOptions = {}) {
	const animator = new FuzzyTextAnimator(element, options);
	animator.init();
	return animator;
}

declare global {
	interface Window {
		fuzzyText?: { attachFuzzyTextToElement: typeof attachFuzzyTextToElement };
		starfieldInstance?: any;
	}
}
