'use strict'

/**
 * HTML helpers shared by the team notes example.
 */

var ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/**
 * Escape a plain-text value for safe inclusion in HTML.
 *
 * @param {string} str
 * @return {string}
 * @public
 */

exports.escapeHtml = function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (ch) {
    return ESCAPE_MAP[ch];
  });
};

/**
 * Clean user-authored note HTML so it can be rendered
 * inside the notes page while keeping basic formatting
 * such as <b>, <i>, <a> and <img>.
 *
 * @param {string} html
 * @return {string}
 * @public
 */

exports.sanitizeHtml = function sanitizeHtml(html) {
  return String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .trim();
};
