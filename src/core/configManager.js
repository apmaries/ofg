// ConfigHandler.js
// Description: Centralized configuration module

let applicationConfig = {
  daysOfWeek: [
    { id: "99", name: "All" },
    { id: "1", name: "Monday" },
    { id: "2", name: "Tuesday" },
    { id: "3", name: "Wednesday" },
    { id: "4", name: "Thursday" },
    { id: "5", name: "Friday" },
    { id: "6", name: "Saturday" },
    { id: "0", name: "Sunday" },
  ],
  outbound: { forecastId: null, operationId: null, fcUrl: null },
  inbound: { inboundMode: false, inboundFcId: null, operationId: null },
  notifications: {
    uri: "",
    id: "",
  },
  testMode: window.location.protocol !== "https:",
  testing: {
    outboundAggregatesDataUrl: "/test/outboundAggregateData.json",
    businessUnitsUrl: "/test/businessUnits.json",
    businessUnitSettingsUrl: "/test/bu.json",
    planningGroupsUrl: "/test/planningGroups.json",
    campaignsUrl: "/test/campaigns.json",
    inboundFcDataUrl: "/test/inboundForecastData.json",
  },
  // Add more configuration options as needed
};

export { applicationConfig };
