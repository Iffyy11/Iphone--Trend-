/** 4-digit PIN for cashiers (1000–9999). */
export function randomPin4(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}
