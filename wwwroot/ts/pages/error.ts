/**
 * pages/error.ts
 * @fileoverview Error page logic
 * @description Handles error page initialization and fuzzy text effect
 */

import { attachFuzzyTextToElement } from '../fuzzyText';

//==============================================================================================
/**
 * Initializes the error page
 * @function initErrorPage
 * @returns {void}
 * @description Handles error page initialization and fuzzy text effect
 */
export default function initErrorPage(): void {
	// Ensure initial loading overlay is dismissed on error page
	document.body.dataset.initialState = 'ready';

	// Ensure starfield initializes and reveals
	const ensureStarfield = () => {
		const sf = document.getElementById('starfield');
		if (sf) {
			sf.classList.remove('starfield-initial');
			sf.classList.add('starfield-initial--enter');
		}
	};

	const attemptEnsure = (tries: number = 6) => {
		if ((window as any).starfieldInstance) {
			ensureStarfield();
			return;
		}
		if (tries > 0) {
			setTimeout(() => attemptEnsure(tries - 1), 50);
		} else {
			// Trigger any late-registered load handlers in starfield
			window.dispatchEvent(new Event('load'));
			setTimeout(ensureStarfield, 0);
		}
	};
	// Schedule after current tick to allow starfield module to attach
	setTimeout(() => attemptEnsure(), 0);

	// Apply fuzzy text effect to header
	const header = document.querySelector('.error-message h3') as HTMLElement | null;
	if (header) {
		attachFuzzyTextToElement(header, {
			fontSize: 'clamp(2rem, 12vw, 8rem)',
			fontWeight: 900,
			fontFamily: 'inherit',
			color: '#fff',
			enableHover: true,
			baseIntensity: 0.18,
			hoverIntensity: 0.5
		});
	}
}
