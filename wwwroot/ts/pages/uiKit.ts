/**
 * pages/uiKit.ts
 * @fileoverview Demo wiring for internal UI kit layout page
 */

import { showAlert, showConfirm, showPrompt } from '../components/dialogs.js';

function bindDemoButtons() {
    const alertBtn = document.querySelector<HTMLElement>('[data-dialog-demo="alert"]');
    const confirmBtn = document.querySelector<HTMLElement>('[data-dialog-demo="confirm"]');
    const promptBtn = document.querySelector<HTMLElement>('[data-dialog-demo="prompt"]');

    if (alertBtn) {
        alertBtn.addEventListener('click', () => {
            showAlert({
                title: 'Heads Up',
                message: 'This is a glass-surface alert dialog. It uses the same SVG + frosted glass stack as the navbar and projects footer.',
                variant: 'info',
            });
        });
    }

    if (confirmBtn) {
        const status = document.querySelector<HTMLElement>('[data-dialog-demo-status="confirm"]');
        confirmBtn.addEventListener('click', async () => {
            const confirmed = await showConfirm({
                title: 'Delete Demo File',
                message: 'This is a confirm-style dialog with primary + secondary actions. On mobile, buttons stack for easier tapping.',
                variant: 'danger',
                primaryLabel: 'Delete',
                secondaryLabel: 'Cancel',
            });
            if (status) {
                status.textContent = confirmed ? 'Last action: Deleted (demo)' : 'Last action: Canceled';
            }
        });
    }

    if (promptBtn) {
        const status = document.querySelector<HTMLElement>('[data-dialog-demo-status="prompt"]');
        promptBtn.addEventListener('click', async () => {
            const name = await showPrompt({
                title: 'Rename Preset',
                message: 'Prompts accept keyboard input and validate required values.',
                placeholder: 'Enter new name',
                defaultValue: '',
                required: true,
                variant: 'success',
                primaryLabel: 'Save',
                secondaryLabel: 'Cancel',
            });
            if (status) {
                status.textContent =
                    name == null || name === ''
                        ? 'Last value: (none)'
                        : `Last value: “${name}”`;
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    bindDemoButtons();
});

export {};


