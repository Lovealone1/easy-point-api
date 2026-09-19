// CID images travel with the message instead of relying on a public API route.
export const EMAIL_LOGO_CID = 'easypoint-logo@easy-point';
export const EMAIL_LOGO_SRC = `cid:${EMAIL_LOGO_CID}`;

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}
