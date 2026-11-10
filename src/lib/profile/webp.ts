/** WebP magic bytes: "RIFF" .... "WEBP". The upload path never trusts the declared mime type. */
export function isWebpBytes(bytes: Uint8Array): boolean {
  const ascii = (start: number, end: number) => new TextDecoder("latin1").decode(bytes.slice(start, end));
  return bytes.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
}
