// testManager.js
// Description: Module for managing test execution

// Shared state modules
import { applicationConfig } from "./configManager.js";

// Global variables
("use strict");

let t_capi = null;
let t_oapi = null;
let t_wapi = null;

// Utility function to fetch test data
async function fetchData(url) {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error(`[OFG] Error fetching data from ${url}`, error);
    throw error;
  }
}

// Prrimary function to initialize test mode
export async function initializeTestMode() {
  console.log("[OFG] Initializing test mode");

  const config = applicationConfig.testing;

  // Define mock data promises
  const outboundAggregatesDataPromise = fetchData(
    config.outboundAggregatesDataUrl
  );
  const campaignsPromise = fetchData(config.campaignsUrl);
  const businessUnitsPromise = fetchData(config.businessUnitsUrl);
  const businessUnitSettingsPromise = fetchData(config.businessUnitSettingsUrl);
  const planningGroupsPromise = fetchData(config.planningGroupsUrl);
  const inboundFcDataPromise = fetchData(config.inboundFcDataUrl);

  // Assign mock data promises to mock API functions
  t_capi = {
    getOutboundConversationsAggregates: function () {
      return outboundAggregatesDataPromise;
    },
  };
  t_oapi = {
    getOutboundCampaigns: function () {
      return campaignsPromise;
    },
  };
  t_wapi = {
    getBusinessUnits: function () {
      return businessUnitsPromise;
    },
    getBusinessUnitData: function () {
      return businessUnitSettingsPromise;
    },
    getPlanningGroups: function () {
      return planningGroupsPromise;
    },
    getInboundShorttermforecastData: function () {
      return inboundFcDataPromise;
    },
  };
}

export { t_capi, t_oapi, t_wapi };
