/**
 * terminalBlink.js
 * @fileoverview Terminal component with blinking caret (for Projects view)
 */

import { logEvent, LogData, LogLevel } from '../../common';

const logTerminal = (event: string, data?: LogData, note?: string, level: LogLevel = 'info') => {
	logEvent('terminalBlink', event, data, note, level);
};
export const stylesHref = '/css/components/bento/terminalBlink.css';

//==============================================================================================
/**
 * Mount the terminal component
 * @param {HTMLElement} container - Container element
 * @param {Object} props - Component props with optional prompt
 * @returns {Promise<Object>} Component instance with setSize, update, destroy methods
 */
export async function mount(container: HTMLElement, props: { prompt?: string } = {}) {
    const root = document.createElement('div');
    root.className = 'comp-terminal';

    const line = document.createElement('div');
    line.className = 'terminal-line';
    const prompt = document.createElement('span');
    prompt.className = 'terminal-prompt';
    prompt.textContent = (props.prompt || 'brandonthomas@mbp ~ %') + ' ';
    const caret = document.createElement('span');
    caret.className = 'terminal-caret';
    caret.textContent = '_';
    line.append(prompt, caret);
    root.appendChild(line);
    container.appendChild(root);
	logTerminal('Mounted', { prompt: prompt.textContent?.trim() });

    return {
        setSize() { /* not required */ },
		update(nextProps: { prompt?: string }) { if (nextProps?.prompt) { prompt.textContent = nextProps.prompt + ' '; logTerminal('Prompt Updated', { prompt: nextProps.prompt }); } },
		destroy() { root.remove(); logTerminal('Destroyed'); }
    };
}
