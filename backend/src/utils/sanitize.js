/**
 * Escapes special regular expression metacharacters in user input
 * to prevent Regular Expression Denial of Service (ReDoS) and syntax errors.
 * @param {string} str
 * @returns {string}
 */
export const escapeRegex = (str = '') => {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

