// queryHandler.js
// Description: Module for building and executing historical queries used in forecast generation

// API instances
import { capi } from "../app.js";
import { t_capi } from "../core/testManager.js";

// Shared state modules
import { applicationConfig } from "../core/configManager.js";
import { applicationState } from "../core/stateManager.js";

// Global variables
("use strict");
const testMode = applicationConfig.testMode;

// Function to build query body
export async function queryBuilder() {
  // Get variables from applicationState
  const forecastPlanningGroups =
    applicationState.forecastOutputs.generatedForecast;
  const timeZone = applicationState.userInputs.businessUnit.settings.timeZone;

  // Log to console
  console.info("[OFG.QUERY] Query body builder initiated");

  // Define predicates array
  let clausePredicates = [];

  // Create predicate for each cpId in forecastPlanningGroups
  forecastPlanningGroups.forEach((pg) => {
    const pgName = pg.planningGroup.name;
    const cpId = pg.campaign.id;
    const numContacts = pg.metadata.numContacts;

    if (cpId && numContacts && Number(numContacts) > 0) {
      clausePredicates.push({
        dimension: "outboundCampaignId",
        value: cpId,
      });
      pg.metadata.forecastStatus = { isForecast: true };
      pg.metadata.forecastMode = "outbound";
    } else {
      if (!cpId) {
        console.warn(
          `[OFG.QUERY] [${pgName}] Skipping query on inbound planning group`,
          pg
        );
        pg.metadata.forecastMode = "inbound";
        pg.metadata.forecastStatus = {
          isForecast: false,
          reason: "Inbound planning groups not forecasted",
        };
      } else if (!numContacts || Number(numContacts) <= 0) {
        console.warn(
          `[OFG.QUERY] [${pgName}] Skipping query with 0 forecast contacts`,
          pg
        );
        pg.metadata.forecastMode = "outbound";
        pg.metadata.forecastStatus = {
          isForecast: false,
          reason: "Zero forecast outbound contacts",
        };
      } else {
        console.warn(
          `[OFG.QUERY] [${pgName}] Skipping query with invalid data`,
          pg
        );
        pg.metadata.forecastStatus = {
          isForecast: false,
          reason: "Invalid data",
        };
      }
    }

    if (pg.metadata.forecastStatus.isForecast) {
      pg.historicalWeeks = [];
      pg.forecastData = {};
    }
  });

  // Define query body
  const queryBody = {
    filter: {
      type: "and",
      clauses: [
        {
          type: "or",
          predicates: clausePredicates,
        },
      ],
      predicates: [{ dimension: "mediaType", value: "voice" }],
    },
    metrics: ["nOutboundAttempted", "nOutboundConnected", "tHandle"],
    groupBy: ["outboundCampaignId"],
    granularity: "PT15M",
    interval: "",
    timeZone: timeZone,
  };

  // Return query body
  console.debug("[OFG.QUERY] Query body: ", queryBody);
  return queryBody;
}

// Function to build query intervals (max 7 days of data when using 15m granularity)
export async function intervalBuilder() {
  // Get variables from applicationState
  const historicalWeeks =
    applicationState.userInputs.forecastParameters.historicalWeeks;
  const buTimeZone = applicationState.userInputs.businessUnit.settings.timeZone;
  const buStartDayOfWeek =
    applicationState.userInputs.businessUnit.settings.startDayOfWeek;

  // Log to console
  console.info("[OFG.QUERY] Query interval builder initiated");

  // Define arrays
  let intervals = [];
  const startOfWeekDays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  // Get the index of the start day of the week
  const startIndex = startOfWeekDays.indexOf(buStartDayOfWeek);

  // Get the current date in the specified time zone
  const now = luxon.DateTime.now().setZone(buTimeZone);

  // Find the most recent start of the week date
  let startOfWeek = now
    .minus({ days: (now.weekday - startIndex + 7) % 7 })
    .startOf("day");

  // If today is the start of the week or within the current week, adjust to the previous week
  if (startOfWeek >= now.startOf("day")) {
    startOfWeek = startOfWeek.minus({ weeks: 1 });
  }

  // Loop for historicalWeeks times to calculate each interval
  for (let i = 0; i < historicalWeeks; i++) {
    // Calculate the end of the week date
    const endOfWeek = startOfWeek.plus({ days: 6 }).endOf("day");

    // Push the interval as ISO string to the intervals array
    intervals.push(`${startOfWeek.toISO()}/${endOfWeek.toISO()}`);

    // Move to the previous week
    startOfWeek = startOfWeek.minus({ weeks: 1 });
  }

  // Return intervals array
  console.debug("[OFG.QUERY] Intervals: ", intervals);
  return intervals;
}

// Function to execute queries
export async function executeQueries(body, intervals) {
  console.info("[OFG.QUERY] Executing queries");
  let results = [];

  // Function to run query
  async function runQuery(body) {
    try {
      const queryResult = await capi.postAnalyticsConversationsAggregatesQuery(
        body
      );
      // Check if the response is an empty object
      if (Object.keys(queryResult).length === 0) {
        return []; // Return an empty array to avoid undefined results
      }
      return queryResult.results; // Return the results
    } catch (error) {
      console.error("[OFG.QUERY] Error getting query results!", error);
      throw error;
    }
  }

  if (testMode) {
    console.info(
      "[OFG.QUERY] Test mode enabled. Static data will be used for forecast generation"
    );

    try {
      results = await t_capi.getOutboundConversationsAggregates();
    } catch (error) {
      console.error("[OFG.QUERY] Test data retrieval failed!", error);
      throw error;
    }

    // Check if the response is an empty object
    if (Object.keys(results).length === 0) {
      return []; // Return an empty array to avoid undefined results
    }

    return results.results;
  } else {
    console.info("[OFG.QUERY] Query execution initiated");

    // Loop through intervals and execute queries
    for (let i = 0; i < intervals.length; i++) {
      console.debug(`[OFG.QUERY] Executing query for interval ${i + 1}`);
      body.interval = intervals[i];
      let queryResults = await runQuery(body);
      if (queryResults.length > 0) {
        results.push(...queryResults);
      } else {
        console.warn(`[OFG.QUERY] No results found for interval ${i + 1}`);
      }
    }

    // Special handling for when results is empty
    if (results.length === 0) {
      console.warn("[OFG.QUERY] No results found");

      // Get test results for testing in prod
      results = await fetch(
        "/sandpit-testing/test/outboundAggregateData_prod.json"
      )
        .then((response) => response.json())
        .then((data) => data.results)
        .catch((error) =>
          console.error("[OFG.QUERY] Error fetching test data: ", error)
        );

      console.info(
        "%c[OFG.QUERY] Test data in prod retrieval successful",
        "color: red"
      );
    } else {
      // Get forecast planning groups from applicationState
      const forecastPlanningGroups =
        applicationState.forecastOutputs.generatedForecast;

      // Return only data for campaigns in forecastPlanningGroups where isForecast is true
      results = results.filter((result) => {
        return forecastPlanningGroups.some((pg) => {
          return (
            pg.campaign.id === result.group.outboundCampaignId &&
            pg.metadata.forecastStatus.isForecast
          );
        });
      });
    }

    // Return results
    console.debug("[OFG.QUERY] Query results: ", results);
    return results;
  }
}
