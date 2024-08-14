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
    outboundAggregatesDataUrl:
      "/sandpit-testing/test/outboundAggregateData.json",
    businessUnitsUrl: "/sandpit-testing/test/businessUnits.json",
    businessUnitSettingsUrl: "/sandpit-testing/test/bu.json",
    planningGroupsUrl: "/sandpit-testing/test/planningGroups.json",
    campaignsUrl: "/sandpit-testing/test/campaigns.json",
    inboundFcDataUrl: "/sandpit-testing/test/inboundForecastData.json",
  },
  // Add more configuration options as needed
};

export { applicationConfig };
