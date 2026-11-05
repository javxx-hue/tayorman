// Copies text. Inside Telegram's built-in browser navigator.clipboard is often blocked, so fall back to the
// older way (a hidden text box and the copy command). Returns whether it worked.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the older way
  }
  try {
    const box = document.createElement('textarea');
    box.value = text;
    box.setAttribute('readonly', '');
    box.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(box);
    box.focus();
    box.select();
    box.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(box);
    return ok;
  } catch {
    return false;
  }
}
