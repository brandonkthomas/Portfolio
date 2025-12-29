/**
 * RealityCheck client
 * Drag/drop uploader that posts images to /api/realitycheck/analyze and renders results.
 */

type DetectionResponse = {
    isLikelyAi: boolean;
    score: number;
    thresholdUsed: number;
    isotropyScore: number;
    logisticProbability?: number | null;
    notes?: string | null;
    features: {
        lambda1: number;
        lambda2: number;
        isotropyRatio: number;
        energy: number;
        sampleCount: number;
        width: number;
        height: number;
    };
    error?: string;
    detail?: string;
};

const dropzone = document.getElementById('rc-dropzone');
const fileInput = document.getElementById('rc-file-input') as HTMLInputElement | null;
const browseBtn = document.getElementById('rc-browse-btn');
const statusEl = document.getElementById('rc-status');
const statusTextEl = document.getElementById('rc-status-text');
const statusFileEl = document.getElementById('rc-status-file');
const statusThumbEl = document.getElementById('rc-status-thumb') as HTMLImageElement | null;
const statusFilenameEl = document.getElementById('rc-status-filename');
const resultEl = document.getElementById('rc-result');
const resultLabel = document.getElementById('rc-result-label');
const notesEl = document.getElementById('rc-notes');

const confidenceEl = document.getElementById('rc-confidence');
const confidenceMeterEl = document.getElementById('rc-confidence-meter');
const confidenceFillEl = document.getElementById('rc-confidence-fill');
const scoreEl = document.getElementById('rc-score');
const scoreMeterEl = document.getElementById('rc-score-meter');
const scoreFillEl = document.getElementById('rc-score-fill');

const fmtPct1 = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 });
const fmtNum2 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

function isFiniteNumber(v: unknown): v is number {
    return typeof v === 'number' && Number.isFinite(v);
}

function clamp01(n: number) {
    return Math.max(0, Math.min(1, n));
}

function clamp0to100(n: number) {
    return Math.max(0, Math.min(100, n));
}

function scoreToPercent(score: unknown): number | null {
    if (!isFiniteNumber(score)) return null;
    if (score >= 0 && score <= 1) return score * 100;
    if (score >= 0 && score <= 100) return score;
    return null;
}

function formatMaybePercent01(v?: number | null) {
    if (!isFiniteNumber(v)) return '—';
    if (v >= 0 && v <= 1) return fmtPct1.format(v);
    return fmtNum2.format(v);
}

function confidenceBand(pct: number) {
    if (pct >= 92) return 'Very high confidence';
    if (pct >= 80) return 'High confidence';
    if (pct >= 65) return 'Medium confidence';
    if (pct >= 55) return 'Low confidence';
    return 'Very low confidence';
}

function computeConfidence(data: DetectionResponse): { pct: number; label: string } | null {
    if (isFiniteNumber(data.logisticProbability)) {
        const pAi = clamp01(data.logisticProbability);
        const pChosen = data.isLikelyAi ? pAi : (1 - pAi);
        const pct = Math.round(pChosen * 100);
        return { pct, label: confidenceBand(pct) };
    }

    if (isFiniteNumber(data.score) && isFiniteNumber(data.thresholdUsed)) {
        const s = data.score;
        const th = data.thresholdUsed;
        if (th > 0 && th < 1 && s >= 0 && s <= 1) {
            const p =
                data.isLikelyAi
                    ? (s - th) / (1 - th)
                    : (th - s) / th;
            const pct = Math.round(clamp01(p) * 100);
            return { pct, label: confidenceBand(pct) };
        }
    }

    return null;
}

let currentPreviewUrl: string | null = null;

function syncStatusEmptyClass() {
    if (!statusEl) return;
    const msg = (statusTextEl?.textContent || '').trim();
    const hasFile = statusFileEl ? !statusFileEl.hidden : false;
    statusEl.classList.toggle('rc-status--empty', !msg && !hasFile);
}

function setStatus(msg: string, isError = false) {
    if (!statusEl) return;
    if (statusTextEl) {
        statusTextEl.textContent = msg;
    } else {
        statusEl.textContent = msg;
    }
    statusEl.classList.toggle('rc-status--error', isError);
    syncStatusEmptyClass();
}

function setStatusFile(file: File | null) {
    if (!statusFileEl || !statusThumbEl || !statusFilenameEl) {
        return;
    }

    if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
        currentPreviewUrl = null;
    }

    if (!file) {
        statusFileEl.hidden = true;
        statusFilenameEl.textContent = '';
        statusThumbEl.removeAttribute('src');
        statusThumbEl.alt = '';
        syncStatusEmptyClass();
        return;
    }

    statusFileEl.hidden = false;
    statusFilenameEl.textContent = file.name;
    currentPreviewUrl = URL.createObjectURL(file);
    statusThumbEl.src = currentPreviewUrl;
    statusThumbEl.alt = file.name;
    syncStatusEmptyClass();
}

function showResult(data: DetectionResponse) {
    if (
        !resultEl ||
        !resultLabel ||
        !confidenceEl ||
        !confidenceMeterEl ||
        !confidenceFillEl ||
        !scoreEl ||
        !scoreMeterEl ||
        !scoreFillEl
    ) {
        return;
    }

    const ai = data.isLikelyAi;
    const conf = computeConfidence(data);

    resultLabel.textContent = ai ? 'Possibly AI-generated' : 'Likely real';
    resultLabel.className = `rc-result-label ${ai ? 'rc-ai' : 'rc-real'}`;

    const scorePctRaw = scoreToPercent(data.score);
    const scorePct = isFiniteNumber(scorePctRaw) ? clamp0to100(scorePctRaw) : 0;
    scoreEl.textContent = formatMaybePercent01(data.score);
    scoreEl.title = isFiniteNumber(data.thresholdUsed) ? `Threshold: ${formatMaybePercent01(data.thresholdUsed)}` : '';

    scoreMeterEl.classList.toggle('rc-meter--ai', ai);
    scoreMeterEl.classList.toggle('rc-meter--real', !ai);
    scoreMeterEl.setAttribute('aria-valuenow', String(Math.round(scorePct)));
    scoreFillEl.style.transform = 'scaleX(0)';

    const confPct = conf ? conf.pct : 0;
    confidenceEl.textContent = conf ? `${conf.pct}%` : '—';
    confidenceMeterEl.classList.toggle('rc-meter--ai', ai);
    confidenceMeterEl.classList.toggle('rc-meter--real', !ai);
    confidenceMeterEl.setAttribute('aria-valuenow', String(confPct));
    confidenceFillEl.style.transform = 'scaleX(0)';

    requestAnimationFrame(() => {
        scoreFillEl.style.transform = `scaleX(${scorePct / 100})`;
        confidenceFillEl.style.transform = `scaleX(${confPct / 100})`;
    });

    if (notesEl) {
        const hasNotes = Boolean(data.notes);
        notesEl.hidden = !hasNotes;
        notesEl.textContent = hasNotes ? data.notes || '' : '';
        if (conf) {
            notesEl.title = conf.label;
        }
    }

    resultEl.hidden = false;
}

async function uploadFile(file: File) {
    const fd = new FormData();
    fd.append('file', file);

    setStatus('Uploading and analyzing...', false);
    if (resultEl) {
        resultEl.hidden = true;
    }

    try {
        const resp = await fetch('/api/realitycheck/analyze', {
            method: 'POST',
            body: fd
        });

        const data = (await resp.json()) as DetectionResponse;

        if (!resp.ok || (data as any).error) {
            const msg = (data as any).error || resp.statusText || 'Upload failed';
            setStatus(msg, true);
            return;
        }

        setStatus('Analysis complete');
        showResult(data);
    } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Upload failed', true);
    }
}

function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) {
        setStatusFile(null);
        setStatus('No file selected', true);
        return;
    }
    const file = files[0];
    if (!file.type.startsWith('image/')) {
        setStatusFile(null);
        setStatus('Please choose an image file.', true);
        return;
    }
    setStatusFile(file);
    uploadFile(file);
}

function wireDragAndDrop() {
    if (!dropzone) return;

    const enter = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('rc-dropzone--hover');
    };
    const over = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };
    const leave = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('rc-dropzone--hover');
    };
    const drop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('rc-dropzone--hover');
        handleFiles(e.dataTransfer?.files ?? null);
    };

    dropzone.addEventListener('dragenter', enter);
    dropzone.addEventListener('dragover', over);
    dropzone.addEventListener('dragleave', leave);
    dropzone.addEventListener('dragend', leave);
    dropzone.addEventListener('drop', drop);

    dropzone.addEventListener('click', (e) => {
        const target = e.target as HTMLElement | null;
        if (target && target.closest('#rc-browse-btn')) return;
        fileInput?.click();
    });
}

function wireBrowse() {
    if (browseBtn) {
        browseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput?.click();
        });
    }
    if (fileInput) {
        fileInput.addEventListener('change', () => handleFiles(fileInput.files));
    }
}

wireDragAndDrop();
wireBrowse();

window.addEventListener('beforeunload', () => {
    if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
        currentPreviewUrl = null;
    }
});

export {};
