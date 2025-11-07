/**
 * terminalBlink.js
 * @fileoverview Terminal component with blinking caret (for Projects view)
 */

export const stylesHref = '/css/components/terminalBlink.css';

//==============================================================================================
/**
 * Mount the terminal component
 * @param {Element} container   
 * @param {Object} props
 * @returns {Promise<{setSize: () => void, update: (nextProps: Object) => void, destroy: () => void}>}
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

    return {
        setSize() { /* not required */ },
        update(nextProps: { prompt?: string }) { if (nextProps?.prompt) prompt.textContent = nextProps.prompt + ' '; },
        destroy() { root.remove(); }
    };
}
