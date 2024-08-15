// eventUtils.js
// Description: Utility functions for managing event listeners.

/* Example usage in a module:
  addEvent(button, 'click', handleButtonClick);
  addEvent(input, 'input', handleInputChange);
*/

// Global variables
("use strict");

// Store all the event listeners
const eventListeners = new Map();

/**
 * Add an event listener to an element and store its reference for later removal
 * @param {HTMLElement} element - The DOM element to attach the event listener to.
 * @param {string} event - The event type (e.g., 'click').
 * @param {Function} handler - The event handler function.
 * @param {Object} [options] - Optional parameters for addEventListener.
 */
export function addEvent(element, event, handler, options = {}) {
  element.addEventListener(event, handler, options);

  // Store the event listener for later removal
  if (!eventListeners.has(element)) {
    eventListeners.set(element, []);
  }
  eventListeners.get(element).push({ event, handler, options });
}

/**
 * Remove all event listeners from an element
 * @param {HTMLElement} element - The DOM element to remove event listeners from.
 */
export function removeEventListeners(element) {
  if (!eventListeners.has(element)) return;

  // Remove each event listener from the element
  for (const { event, handler, options } of eventListeners.get(element)) {
    element.removeEventListener(event, handler, options);
  }

  // Clear the event listeners for the element
  eventListeners.delete(element);
}

/**
 * Remove a specific event listener from an element
 * @param {HTMLElement} element - The DOM element to remove the event listener from.
 * @param {string} event - The event type (e.g., 'click').
 * @param {Function} handler - The event handler function.
 * @param {Object} [options] - Optional parameters for removeEventListener.
 */
export function removeEventListener(element, event, handler, options = {}) {
  element.removeEventListener(event, handler, options);

  if (eventListeners.has(element)) {
    const updatedListeners = eventListeners
      .get(element)
      .filter(
        (listener) => listener.event !== event || listener.handler !== handler
      );
    if (updatedListeners.length > 0) {
      eventListeners.set(element, updatedListeners);
    } else {
      eventListeners.delete(element);
    }
  }
}
