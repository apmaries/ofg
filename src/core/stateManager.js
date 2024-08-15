// stateHandler.js
// Description: Centralized state management module

let applicationState = {
  forecastOutputs: { generatedForecast: null, modifiedForecast: null },
  userInputs: {
    businessUnit: {
      name: null,
      id: null,
      settings: null,
    },
    forecastParameters: {
      weekStart: null,
      historicalWeeks: null,
      description: null,
    },
    forecastOptions: {
      ignoreZeroes: null,
      resolveContactsAhtMode: null,
      generateInbound: null,
      retainInbound: null,
    },
    planningGroups: [],
  },
  // Add more state variables as needed
};

export { applicationState };
