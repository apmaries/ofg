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
  displayErrorReason,
  unhideElement,
  updateLoadingMessage,
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
    displayErrorReason(
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
    displayErrorReason(
      "Error processing query results",
      processingError.message || processingError
    );
  }

  try {
    updateLoadingMessage("generate-loading-message", "Preparing forecast");
    await prepareForecast();
  } catch (prepError) {
    displayErrorReason(
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
      if (!applicationState.userInputs.forecastOptions.retainInbound) {
        deleteInboundForecast();
      }
      console.info("[OFG.GENERATE] Inbound groups processed");
    } catch (inboundError) {
      displayErrorReason(
        "Error generating inbound forecast",
        inboundError.message || inboundError
      );
    }
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
      unhideElement("import-step-one-success-icon");
      unhideElement("import-step-one");
      unhideElement("import-step-two-success-icon");
      unhideElement("import-step-two");
      unhideElement("import-step-three-success-icon");
      unhideElement("import-step-three");
      unhideElement("import-step-four-success-icon");
      unhideElement("import-step-four");
      unhideElement("import-step-five-success-icon");
      unhideElement("import-step-five");
      unhideElement("import-success-div");
      document.getElementById("open-forecast-button").disabled = false;
    } else {
      updateLoadingMessage(
        "results-loading-message",
        "Subscribing to forecast import notifications..."
      );

      // Handle the inbound forecast notification
      async function handleImportNotification(notification) {
        console.log("[OFG.IMPORT] Notification received:", notification);

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
            applicationConfig.outbound.forecastId =
              notification.eventBody.result.id;
            applicationConfig.outbound.selfUri =
              notification.eventBody.result.selfUri;

            document.getElementById("open-forecast-button").disabled = false;
            window.dispatchEvent(new CustomEvent("inboundForecastComplete"));
          } else {
            window.dispatchEvent(new CustomEvent("inboundForecastError"));
          }
        }
      }

      try {
        const topics = ["shorttermforecasts.import"];
        const importNotifications = new NotificationHandler(
          topics,
          buId,
          runImport,
          handleImportNotification
        );
        importNotifications.connect();
        importNotifications.subscribeToNotifications();
      } catch (notificationError) {
        displayErrorReason(
          "Subscribing to notifications failed!",
          notificationError.message || notificationError
        );
      }

      updateLoadingMessage(
        "results-loading-message",
        "Preparing import file..."
      );
      let fcImportBody, importGzip, contentLength;
      try {
        [fcImportBody, importGzip, contentLength] = await prepFcImportBody(
          applicationState.forecastOutputs.modifiedForecast,
          startDayOfWeek,
          description
        );
        unhideElement("import-step-one-success-icon");
      } catch (prepError) {
        unhideElement("import-step-one-fail-icon");
        displayErrorReason(
          "Import file preparation failed!",
          prepError.message || prepError
        );
      } finally {
        unhideElement("import-step-one");
      }

      let fcImportUrl;
      try {
        updateLoadingMessage(
          "results-loading-message",
          "Generating upload URL..."
        );
        fcImportUrl = await generateUrl(buId, weekStart, contentLength);
        unhideElement("import-step-two-success-icon");
      } catch (urlError) {
        unhideElement("import-step-two-fail-icon");
        displayErrorReason(
          "Upload URL generation failed!",
          urlError.message || urlError
        );
      } finally {
        unhideElement("import-step-two");
      }

      let uploadResponse;
      try {
        updateLoadingMessage(
          "results-loading-message",
          "Uploading import file..."
        );
        uploadResponse = await invokeGCF(
          fcImportUrl,
          importGzip,
          contentLength
        );
        unhideElement("import-step-three-success-icon");
      } catch (uploadError) {
        console.warn(uploadError);
        console.warn(uploadError.message);
        unhideElement("import-step-three-fail-icon");
        displayErrorReason(
          "Import file upload failed!",
          uploadError.message || uploadError
        );
      } finally {
        unhideElement("import-step-three");
      }

      // temp logging
      console.log(
        "[OFG.TEMP] uploadResponse = ",
        uploadResponse,
        uploadResponse.status
      );

      if (uploadResponse && uploadResponse.status === 200) {
        console.info("[OFG.IMPORT] Forecast upload to URL successful");

        const runImport = async () => {
          updateLoadingMessage(
            "import-loading-message",
            "Importing forecast..."
          );
          try {
            await importFc(buId, weekStart);
            unhideElement("import-step-four-success-icon");
          } catch (runImportError) {
            unhideElement("import-step-four-fail-icon");
            displayErrorReason(
              "Forecast import failed!",
              runImportError.message || runImportError
            );
          } finally {
            unhideElement("import-step-four");
          }
        };
      } else {
        const reason = uploadResponse.data.reason;
        displayErrorReason("Forecast import failed!", reason);
      }
    }
  } catch (error) {
    console.error("[OFG.IMPORT] Forecast import failed:", error);
  }
}

export function initializeApp() {
  console.log("[APP] Application initialized");
}
