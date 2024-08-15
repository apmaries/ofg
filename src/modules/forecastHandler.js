// forecastHandler.js
// Description:Main application module

// Shared state modules
import { applicationConfig } from "../core/configManager.js";
import { applicationState } from "../core/stateManager.js";

// App modules
import {
  queryBuilder,
  intervalBuilder,
  executeQueries,
} from "./queryHandler.js";
import {
  prepFcMetrics,
  generateAverages,
  applyContacts,
} from "./numberHandler.js";
import {
  generateInboundForecast,
  deleteInboundForecast,
} from "./inboundHandler.js";
import {
  prepFcImportBody,
  generateUrl,
  invokeGCF,
  importFc,
} from "./importHandler.js";
import { NotificationHandler } from "./notificationHandler.js";

// Utility modules
import {
  displayErrorCard,
  unhideElement,
  updateLoadingMessage,
  updateStatusMessage,
} from "../utils/domUtils.js";

// Global variables
("use strict");
const testMode = applicationConfig.testMode;

// Generate outbound forecast data
export async function generateForecast() {
  console.info("[OFG.GENERATE] Generation started");

  applicationState.forecastOutputs.generatedForecast =
    applicationState.userInputs.planningGroups.map((pg) => ({
      planningGroup: { ...pg.planningGroup },
      campaign: { ...pg.campaign },
      queue: { ...pg.queue },
      metadata: { numContacts: pg.numContacts },
    }));

  // Helper functions
  function getWeek(date) {
    const dateCopy = new Date(date.getTime());
    dateCopy.setHours(0, 0, 0, 0);
    dateCopy.setDate(dateCopy.getDate() + 3 - ((dateCopy.getDay() + 6) % 7));
    const week1 = new Date(dateCopy.getFullYear(), 0, 4);
    return (
      1 +
      Math.round(
        ((dateCopy.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7
      )
    );
  }

  function getWeekYear(date) {
    const dateCopy = new Date(date.getTime());
    dateCopy.setDate(dateCopy.getDate() + 3 - ((dateCopy.getDay() + 6) % 7));
    return dateCopy.getFullYear();
  }

  function getYearWeek(date) {
    const week = getWeek(date);
    const year = getWeekYear(date);
    return `${year}-${String(week).padStart(2, "0")}`;
  }

  async function processQueryResults(results) {
    console.info(`[OFG.GENERATE] Processing ${results.length} query groups`);
    const generatedForecast =
      applicationState.forecastOutputs.generatedForecast;

    for (const resultsGrouping of results) {
      const { group, data } = resultsGrouping;
      const campaignId = group.outboundCampaignId;
      const planningGroupIndex = generatedForecast.findIndex(
        (pg) => pg.campaign.id === campaignId
      );

      if (planningGroupIndex === -1) {
        console.warn(
          `[OFG.GENERATE] Campaign ID ${campaignId} not found, skipping...`
        );
        continue;
      }

      const baseWeekArray = Array.from({ length: 7 }, () =>
        Array.from({ length: 96 }, () => 0)
      );
      let weekObj = {
        weekNumber: "",
        intradayValues: {
          nAttempted: JSON.parse(JSON.stringify(baseWeekArray)),
          nConnected: JSON.parse(JSON.stringify(baseWeekArray)),
          tHandle: JSON.parse(JSON.stringify(baseWeekArray)),
          nHandled: JSON.parse(JSON.stringify(baseWeekArray)),
        },
      };

      for (const { interval, metrics } of data) {
        const [startString] = interval.split("/");
        const startDate = new Date(startString);
        const weekNumber = getYearWeek(startDate);
        const dayIndex = startDate.getDay();
        const totalMinutes = startDate.getHours() * 60 + startDate.getMinutes();
        const intervalIndex = Math.floor(totalMinutes / 15);

        const historicalWeeks =
          generatedForecast[planningGroupIndex].historicalWeeks;
        if (!historicalWeeks) continue;

        if (!historicalWeeks.some((week) => week.weekNumber === weekNumber)) {
          weekObj.weekNumber = weekNumber;
          historicalWeeks.push(weekObj);
        }

        for (const metric of metrics) {
          if (metric.metric === "nOutboundAttempted") {
            weekObj.intradayValues.nAttempted[dayIndex][intervalIndex] +=
              metric.stats.count;
          }
          if (metric.metric === "nOutboundConnected") {
            weekObj.intradayValues.nConnected[dayIndex][intervalIndex] +=
              metric.stats.count;
          }
          if (metric.metric === "tHandle") {
            weekObj.intradayValues.tHandle[dayIndex][intervalIndex] +=
              metric.stats.sum / 1000;
            weekObj.intradayValues.nHandled[dayIndex][intervalIndex] +=
              metric.stats.count;
          }
        }
      }
    }
    validateHistoricalData();
    console.info("[OFG.GENERATE] Query results processed");
  }

  function validateHistoricalData() {
    console.debug("[OFG.GENERATE] Validating historical data");
    const generatedForecast =
      applicationState.forecastOutputs.generatedForecast;

    for (const group of generatedForecast) {
      const { name } = group.planningGroup;
      const { forecastMode } = group.metadata;

      if (forecastMode === "inbound") continue;

      const historicalWeeks = group.historicalWeeks;
      if (!historicalWeeks || historicalWeeks.length === 0) {
        console.warn(`[OFG.GENERATE] No historical data for ${name}`);
        group.metadata.forecastStatus = {
          isForecast: false,
          reason: "No historical data",
        };
      }
    }
  }

  async function runFunctionOnGroup(group, func, funcName, ...args) {
    const { name } = group.planningGroup;
    console.debug(`[OFG.GENERATE] Running ${funcName} on ${name}`);
    try {
      return await func(group, ...args);
    } catch (error) {
      console.error(`[OFG.GENERATE] Error in ${funcName} for ${name}:`, error);
    }
    return group;
  }

  async function prepareForecast() {
    console.info("[OFG.GENERATE] Preparing forecast");
    const functionsToRun = [
      { func: prepFcMetrics, name: "prepFcMetrics" },
      {
        func: generateAverages,
        name: "generateAverages",
        args: [applicationState.userInputs.forecastOptions.ignoreZeroes],
      },
      { func: applyContacts, name: "applyContacts" },
    ];

    const generatedForecast =
      applicationState.forecastOutputs.generatedForecast;
    const fcPrepPromises = generatedForecast
      .filter((group) => group.metadata.forecastStatus.isForecast)
      .map(async (group) => {
        console.log(`[OFG.GENERATE] Processing ${group.planningGroup.name}`);
        for (const { func, name, args = [] } of functionsToRun) {
          group = await runFunctionOnGroup(group, func, name, ...args);
        }
        console.log(`[OFG.GENERATE] Completed ${group.planningGroup.name}`);
        return group;
      });

    return Promise.all(fcPrepPromises).then(() => {
      console.info("[OFG.GENERATE] All groups processed");
    });
  }

  // Main forecast generation logic
  let queryBody, intervals;
  try {
    updateLoadingMessage("generate-loading-message", "Building queries");
    queryBody = await queryBuilder();

    updateLoadingMessage(
      "generate-loading-message",
      "Generating query intervals"
    );
    intervals = await intervalBuilder();
  } catch (queryBodyError) {
    console.error(
      "[OFG.GENERATE] Error generating historical data queries: ",
      queryBodyError
    );
    throw queryBodyError;
  }

  let queryResults = [];
  try {
    updateLoadingMessage("generate-loading-message", "Executing queries");
    queryResults = await executeQueries(queryBody, intervals);

    if (queryResults.length === 0) {
      const reason = "No historical data found";
      console.error("[OFG.GENERATE] " + reason);
      throw new Error(reason);
    }
  } catch (queryError) {
    displayErrorCard(
      "Error executing historical data queries",
      queryError.message || queryError
    );
  }

  try {
    updateLoadingMessage(
      "generate-loading-message",
      "Processing query results"
    );
    await processQueryResults(queryResults);
  } catch (processingError) {
    displayErrorCard(
      "Error processing query results",
      processingError.message || processingError
    );
  }

  try {
    updateLoadingMessage("generate-loading-message", "Preparing forecast");
    await prepareForecast();
  } catch (prepError) {
    displayErrorCard(
      "Error preparing forecast",
      prepError.message || prepError
    );
  }

  if (applicationState.userInputs.forecastOptions.generateInbound) {
    updateLoadingMessage(
      "generate-loading-message",
      "Generating inbound forecast"
    );
    applicationState.forecastOutputs.generatedForecast.forEach((pg) => {
      if (pg.metadata.forecastMode === "inbound") {
        pg.metadata.forecastStatus = { isForecast: true };
        delete pg.metadata.forecastStatus.reason;
      }
    });

    try {
      await generateInboundForecast();

      // Dispatch a custom event when the forecast generation is complete
      const event = new CustomEvent("inboundForecastComplete", {
        detail: {
          retainInbound:
            applicationState.userInputs.forecastOptions.retainInbound,
        },
      });
      window.dispatchEvent(event);

      console.info("[OFG.GENERATE] Inbound groups processed");
    } catch (inboundError) {
      displayErrorCard(
        "Error generating inbound forecast",
        inboundError.message || inboundError
      );
    }

    // Listen for the custom event and delete the inbound forecast if needed
    window.addEventListener("inboundForecastComplete", (event) => {
      if (!event.detail.retainInbound) {
        deleteInboundForecast();
      }
    });
  }
}

// Import forecast to GC
export async function importForecast() {
  try {
    console.info("[OFG.IMPORT] Forecast import started");

    const { id: buId } = applicationState.userInputs.businessUnit;
    const { weekStart, description } =
      applicationState.userInputs.forecastParameters;
    const startDayOfWeek =
      applicationState.userInputs.businessUnit.settings.startDayOfWeek;

    if (testMode) {
      function delayUpdate(step, status, delay) {
        return new Promise((resolve) => {
          setTimeout(() => {
            updateStatusMessage(step, status);
            resolve();
          }, delay);
        });
      }

      async function updateAllStatusMessages() {
        await delayUpdate("one", "success", 1000);
        await delayUpdate("two", "success", 1000);
        await delayUpdate("three", "success", 1000);
        await delayUpdate("four", "success", 1000);
        await delayUpdate("five", "success", 1000);
      }

      await updateAllStatusMessages();
      unhideElement("import-success-div");
      // Can't make this work easily - keep the button disabled for now
      //document.getElementById("open-forecast-button").disabled = false;
      return;
    }

    // Subscribe to the import notification
    async function subscribe() {
      try {
        const topics = ["shorttermforecasts.import"];
        const importNotifications = new NotificationHandler(
          topics,
          buId,
          runImport, // Execute the import operation on successful subscription
          handleImportNotification // Handle import notification
        );
        importNotifications.connect();
        importNotifications.subscribeToNotifications();
        updateStatusMessage("one", "success");

        // Run the import operation
        async function runImport() {
          // STEP TWO - PREP FC IMPORT BODY
          let fcImportBody, importGzip, contentLength;
          try {
            [fcImportBody, importGzip, contentLength] = await prepFcImportBody(
              applicationState.forecastOutputs.modifiedForecast,
              startDayOfWeek,
              description
            );
            updateStatusMessage("two", "success");
          } catch (prepError) {
            updateStatusMessage("two", "failed");
            displayErrorCard(
              "Forecast import file preparation failed!",
              prepError.message || prepError
            );
          }

          // STEP THREE - GENERATE URL
          let urlResponse;
          try {
            urlResponse = await generateUrl(buId, weekStart, contentLength);
            updateStatusMessage("three", "success");
          } catch (urlError) {
            updateStatusMessage("three", "failed");
            displayErrorCard(
              "Forecast import URL generation failed!",
              urlError.message || urlError
            );
          }

          // STEP FOUR - UPLOAD FILE
          let uploadResponse;
          try {
            uploadResponse = await invokeGCF(
              urlResponse,
              fcImportBody,
              contentLength
            );
            updateStatusMessage("four", "success");
          } catch (uploadError) {
            updateStatusMessage("four", "failed");
            displayErrorCard(
              "Forecast import file upload failed!",
              uploadError.message || uploadError
            );
          }

          // STEP FIVE - IMPORT FC
          let importResponse;
          try {
            importResponse = await importFc(
              buId,
              weekStart,
              urlResponse.uploadKey
            );

            if (importResponse.status === "Complete") {
              // Synchronous handling if the forecast is already complete
              console.log("[OFG.IMPORT] Forecast import complete!");
              applicationConfig.outbound.forecastId = importResponse.result.id;

              updateStatusMessage("five", "success");
              unhideElement("import-success-div");
              importNotifications.disconnect();
            } else if (importResponse.status === "Processing") {
              // Asynchronous handling if the forecast is still processing
              console.log("[OFG.IMPORT] Forecast import processing...");
              applicationConfig.outbound.operationId =
                importResponse.operationId;
              // Further operations handled via notification in handleImportNotification()
            }
          } catch (runImportError) {
            unhideElement("import-step-five-fail-icon");
            displayErrorCard(
              "Forecast import failed!",
              runImportError.message || runImportError
            );
          }
        }

        // Handle forecast notification
        async function handleImportNotification(notification) {
          // Check if "shorttermforecasts.generate" notification
          if (!notification.topicName.includes("shorttermforecasts.import")) {
            return;
          }

          console.log("[OFG.IMPORT] Processing result from notification");

          let importOperationId = applicationConfig.outbound.operationId;

          if (
            notification.eventBody &&
            notification.eventBody.operationId === importOperationId
          ) {
            const status = notification.eventBody.status;
            console.log(
              `[OFG.INBOUND] Generate inbound forecast status updated <${status}>`
            );

            if (status === "Complete") {
              const fcId = notification.eventBody.result.id;
              // Get region from session storage
              const region = sessionStorage.getItem("gc_region");

              // Build the forecast URL
              const fcUrl = `https://apps.${region}/directory/#/admin/wfm/forecasts/${buId}/update/${weekStart}${fcId}`;

              applicationConfig.outbound.forecastId = fcId;
              applicationConfig.outbound.fcUrl = fcUrl;

              // Can't make this work easily - keep the button disabled for now
              //document.getElementById("open-forecast-button").disabled = false;

              updateStatusMessage("five", "success");
              unhideElement("import-success-div");
              importNotifications.disconnect();
            } else if (status === "Error") {
              const errorMessage = notification.metadata.errorInfo.userMessage;
              updateStatusMessage("five", "failed");
              displayErrorCard("Forecast import failed!", errorMessage);
              importNotifications.disconnect();
            }
          }
        }
      } catch (notificationError) {
        updateStatusMessage("one", "failed");
        displayErrorCard(
          "Subscribing to notifications failed!",
          notificationError.message || notificationError
        );
      }
    }

    await subscribe();
  } catch (error) {
    console.error("[OFG.IMPORT] Forecast import failed:", error);
  }
}

export function initializeApp() {
  console.log("[APP] Application initialized");
}
