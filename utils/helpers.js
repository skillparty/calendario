// Shared utility functions for Calendar10

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
