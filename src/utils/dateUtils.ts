/**
 * Utility to format dates in European format (GG/MM/AAAA)
 * Handles ISO strings YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss, DD/MM/YYYY, etc.
 */
export function formatItalianDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (!clean) return '';

  // If already in DD/MM/YYYY or DD-MM-YYYY format
  if (/^[0-9]{2}[\/\.-][0-9]{2}[\/\.-][0-9]{4}/.test(clean)) {
    return clean.replace(/-/g, '/');
  }

  // If YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoMatch = clean.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  }

  return clean;
}
