// How a part is named where it is printed or listed on a job or invoice.

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * "Spark plug – NGK" + part # "BKR6E" -> "Spark plug – NGK (BKR6E)", so the number prints on the invoice and
 * shows in the job's parts list. A name that already contains the number (shops that typed both into the
 * name before there was a Part # field) is left alone, so nothing is ever doubled.
 */
export function partLineName(name: string, partNumber: string | null | undefined): string {
  const number = partNumber?.trim();
  if (!number) return name;
  if (squash(name).includes(squash(number))) return name;
  return `${name} (${number})`;
}
