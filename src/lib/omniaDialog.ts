type DialogOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  inputRequired?: boolean;
  defaultValue?: string;
};

export async function omniaDialog(options: DialogOptions): Promise<{ confirmed: boolean; value: string }> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[1px]';

    const card = document.createElement('div');
    card.className = 'w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl';

    const title = document.createElement('h2');
    title.className = 'text-lg font-bold text-[#002050]';
    title.textContent = options.title;
    card.appendChild(title);

    if (options.message) {
      const msg = document.createElement('p');
      msg.className = 'mt-2 text-sm text-slate-600';
      msg.textContent = options.message;
      card.appendChild(msg);
    }

    let input: HTMLTextAreaElement | null = null;
    let error: HTMLDivElement | null = null;

    if (options.inputLabel) {
      const label = document.createElement('label');
      label.className = 'mt-4 block text-sm font-semibold text-slate-700';
      label.textContent = options.inputLabel;
      card.appendChild(label);

      input = document.createElement('textarea');
      input.rows = 4;
      input.value = options.defaultValue || '';
      input.placeholder = options.inputPlaceholder || '';
      input.className = 'mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-[#BF8813]';
      card.appendChild(input);

      error = document.createElement('div');
      error.className = 'mt-2 hidden text-xs font-semibold text-red-600';
      error.textContent = 'Ce champ est obligatoire.';
      card.appendChild(error);
    }

    const actions = document.createElement('div');
    actions.className = 'mt-5 flex justify-end gap-2';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50';
    cancel.textContent = options.cancelLabel || 'Annuler';

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = options.danger
      ? 'rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700'
      : 'rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-bold text-white hover:opacity-95';
    confirm.textContent = options.confirmLabel || 'Confirmer';

    actions.append(cancel, confirm);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const finish = (confirmed: boolean) => {
      const value = input?.value.trim() || '';
      overlay.remove();
      resolve({ confirmed, value });
    };

    cancel.addEventListener('click', () => finish(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(false); });
    confirm.addEventListener('click', () => {
      if (input && options.inputRequired && !input.value.trim()) {
        error?.classList.remove('hidden');
        input.focus();
        return;
      }
      finish(true);
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onKey);
        finish(false);
      }
    };
    document.addEventListener('keydown', onKey);
    setTimeout(() => input?.focus(), 0);
  });
}
