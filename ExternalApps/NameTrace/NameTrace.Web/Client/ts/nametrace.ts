/**
 * NameTrace client
 */

type LookupResponse = { phone: string; name: string | null };

const form = document.getElementById('nt-form') as HTMLFormElement | null;
const input = document.getElementById('nt-phone-input') as HTMLInputElement | null;
const submitBtn = document.getElementById('nt-submit') as HTMLButtonElement | null;
const statusEl = document.getElementById('nt-status') as HTMLElement | null;
const statusTextEl = document.getElementById('nt-status-text') as HTMLElement | null;
const resultEl = document.getElementById('nt-result') as HTMLElement | null;
const nameEl = document.getElementById('nt-name') as HTMLElement | null;
const spinnerEl = document.getElementById('nt-spinner') as HTMLElement | null;

//==============================================================================================
/**
 * Normalizes the phone input
 * @param {string} raw - The raw phone input
 * @returns {string} The normalized phone input
 */
function normalizePhoneInput(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';

    const match = trimmed.match(/^(\+)?([\d\s().\-]+)$/);
    if (!match) return '';

    const hasPlus = !!match[1];
    const digits = match[2].replace(/\D+/g, '');
    if (!digits || digits.length < 7) return '';

    return (hasPlus ? '+' : '') + digits;
}

//==============================================================================================
/**
 * Formats the phone input for display
 * @param {string} raw - The raw phone input
 * @returns {string} The formatted phone input
 */
function formatUsPhoneForInput(raw: string): { formatted: string; digits: string } {
    if (!raw) return { formatted: '', digits: '' };

    const trimmed = raw.trimStart();
    if (trimmed.startsWith('+')) {
        return { formatted: raw, digits: raw.replace(/\D/g, '') };
    }

    const digits = raw.replace(/\D/g, '');
    const len = digits.length;
    if (len === 0) return { formatted: '', digits: '' };

    let formatted: string;
    if (len <= 3) {
        formatted = `(${digits}`;
    } else if (len <= 6) {
        formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
        const area = digits.slice(0, 3);
        const prefix = digits.slice(3, 6);
        const line = digits.slice(6, 10);
        const rest = digits.slice(10);
        formatted = `(${area}) ${prefix}-${line}`;
        if (rest) formatted += ` ${rest}`;
    }

    return { formatted, digits };
}

//==============================================================================================
/**
 * Looks up the phone number
 * @param {string} phone - The phone number to look up
 * @returns {Promise<LookupResponse>} The lookup response
 */
async function lookupPhone(phone: string): Promise<LookupResponse> {
    const resp = await fetch('/api/nametrace/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
    });

    const data = (await resp.json()) as any;
    if (!resp.ok) {
        const message = (data && (data.error as string)) || resp.statusText || 'Lookup failed';
        throw new Error(message);
    }

    return {
        phone: (data.phone as string) ?? phone,
        name: (data.name as string | null | undefined) ?? null
    };
}

//==============================================================================================
/**
 * Initializes the NameTrace client
 */
function init() {
    if (!form || !input || !submitBtn || !statusEl || !statusTextEl || !resultEl || !nameEl || !spinnerEl) {
        return;
    }

    let isSubmitting = false;

    const setBusy = (busy: boolean) => {
        isSubmitting = busy;
        submitBtn.disabled = busy;
    };

    const syncStatusEmptyClass = () => {
        const msg = (statusTextEl.textContent || '').trim();
        statusEl.classList.toggle('nt-status--empty', !msg);
    };

    const setStatus = (message: string, isError = false) => {
        statusTextEl.textContent = message;
        statusEl.classList.toggle('nt-status--error', isError);
        syncStatusEmptyClass();
    };

    const beginLoading = () => {
        resultEl.hidden = false;
        resultEl.classList.remove('nt-result--visible');
        nameEl.classList.add('nt-name--hidden');
        spinnerEl.classList.add('nt-spinner--visible');
        requestAnimationFrame(() => resultEl.classList.add('nt-result--visible'));
    };

    const endLoading = () => {
        spinnerEl.classList.remove('nt-spinner--visible');
        nameEl.classList.remove('nt-name--hidden');
    };

    const renderName = (value: string) => {
        nameEl.textContent = value || '—';
        resultEl.hidden = false;
        resultEl.classList.add('nt-result--visible');
        spinnerEl.classList.remove('nt-spinner--visible');
        nameEl.classList.remove('nt-name--hidden');
    };

    const clearResult = () => {
        resultEl.classList.remove('nt-result--visible');
        spinnerEl.classList.remove('nt-spinner--visible');
        nameEl.classList.remove('nt-name--hidden');
        nameEl.textContent = '—';
        resultEl.hidden = true;
    };

    input.addEventListener('input', (event) => {
        const target = event.target as HTMLInputElement;
        const raw = target.value;
        const caret = target.selectionStart ?? raw.length;

        let digitsBeforeCaret = 0;
        for (let i = 0; i < caret; i++) {
            if (/\d/.test(raw[i])) digitsBeforeCaret++;
        }

        const { formatted, digits } = formatUsPhoneForInput(raw);
        target.value = formatted;

        let nextCaret = formatted.length;
        if (digitsBeforeCaret <= digits.length) {
            let count = 0;
            for (let i = 0; i < formatted.length; i++) {
                if (/\d/.test(formatted[i])) count++;
                if (count === digitsBeforeCaret) {
                    nextCaret = i + 1;
                    break;
                }
            }
        }

        try {
            target.setSelectionRange(nextCaret, nextCaret);
        } catch {
            // ignore
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (isSubmitting) return;

        const normalized = normalizePhoneInput(input.value);
        if (!normalized) {
            clearResult();
            setStatus('Enter a valid phone number (digits, spaces, dashes, parentheses, optional +).', true);
            input.focus();
            return;
        }

        clearResult();
        setStatus('Searching…', false);
        setBusy(true);
        beginLoading();

        try {
            const result = await lookupPhone(normalized);
            renderName(result.name || 'Unknown');
            setStatus('Lookup complete.', false);
        } catch (err) {
            setStatus('Lookup failed. Please try again in a moment.', true);
            renderName('Error retrieving name');
            console.error('[NameTrace] lookup failed', err);
        } finally {
            endLoading();
            setBusy(false);
        }
    });
}

init(); // immediately initialize
