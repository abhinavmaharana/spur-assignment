/**
 * Sanitizes user input by escaping HTML special characters
 * Prevents XSS attacks while preserving the message content
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitizes and trims user input
 */
export function sanitizeAndTrim(input: string): string {
  return sanitizeInput(input.trim());
}

