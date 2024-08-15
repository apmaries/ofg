// errorHandler.js
// Description: Centralized error handling module

// Global variables
("use strict");

// Centralized error logging function
function logError(errorDetails) {
  console.error("[OFG] An error occurred:", errorDetails.message);
  console.error("[OFG] Error details:", {
    Source: errorDetails.source,
    Line: errorDetails.lineno,
    Column: errorDetails.colno,
    URL: window.location.href,
    ErrorObject: errorDetails.error,
  });
}

// Global error handler
window.onerror = function (message, source, lineno, colno, error) {
  const errorDetails = { message, source, lineno, colno, error };
  logError(errorDetails);
};

/*
export function handleFcError(genericMessage, specificMessage) {
  console.error(`[OFG] ${genericMessage}: ${specificMessage}`);
  throw new Error(`${genericMessage}!|${specificMessage}`);
}
  */
