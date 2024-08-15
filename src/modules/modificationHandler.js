// modificationHandler.js
// Description: Module to handle forecast data modifications

// Shared state modules
import { applicationState } from "../core/stateManager.js";
import { applicationConfig } from "../core/configManager.js";

// App modules
import { calculateTotals, calculateWeightedAverages } from "./numberHandler.js";

// Utility modules
import { rotateArrays } from "../utils/domUtils.js";

// Global variables
("use strict");
const testMode = applicationConfig.testMode;

/* MAIN FUNCTIONS START */
// Function to get selected planning group data
export async function getSelectedPgForecastData(
  forecastType = "modifiedForecast"
) {
  const planningGroupListBox = document.getElementById(
    "planning-group-listbox"
  );
  const weekDayDropdown = document.getElementById("week-day-dropdown");

  try {
    const selectedOption = planningGroupListBox.querySelector(".gux-selected");
    const selectedWeekDay = weekDayDropdown.value;
    const selectedPgName = selectedOption.dataset.name;
    const selectedPgId = selectedOption.dataset.id;

    let weeklyMode = selectedWeekDay === "99";
    const dayName = applicationConfig.daysOfWeek.find(
      (day) => day.id === selectedWeekDay
    )?.name;

    const selectedPlanningGroup = applicationState.forecastOutputs[
      forecastType
    ].find((group) => group.planningGroup.id === selectedPgId);

    if (!selectedPlanningGroup) {
      throw new Error(
        `Planning group (${selectedPgName}) not found in forecast data.`
      );
    }

    let nContacts = selectedPlanningGroup.forecastData.nContacts;
    let nHandled = selectedPlanningGroup.forecastData.nHandled;
    let tHandle = selectedPlanningGroup.forecastData.tHandle;

    if (selectedPgName && dayName) {
      console.log(
        `[OFG.MODIFICATIONS] [${selectedPgName}] Getting ${
          weeklyMode ? "weekly" : dayName
        } forecast data`
      );
    }

    return {
      selectedPgId,
      selectedWeekDay,
      fcValues: { nContacts, nHandled, tHandle },
    };
  } catch (error) {
    // Planning Group or Week Day not selected. Explicitly return undefined
    return undefined;
  }
}

// Function to populate the UI data
export async function populateGraphAndTable(data) {
  let { selectedPgId, selectedWeekDay, fcValues } = data;
  console.log(
    `[OFG.MODIFICATIONS] [${selectedPgId}] Populating graph & table with data`
  );

  let nContacts = fcValues.nContacts;
  let nHandled = fcValues.nHandled;
  let tHandle = fcValues.tHandle;

  const weeklyMode = selectedWeekDay === "99";

  // Calculate totals and averages
  let nContactTotals = calculateTotals(nContacts);
  let aHandleTimes = calculateWeightedAverages(tHandle, nHandled);

  // Set interval level data for daily mode
  let offeredIntervalsForDay = [];
  let ahtIntervalsForDay = [];
  if (!weeklyMode) {
    offeredIntervalsForDay = nContacts[selectedWeekDay];
    ahtIntervalsForDay = aHandleTimes.intervalAverages[selectedWeekDay];
  }

  // Set daily & weekly level values
  let offeredDaysForWeek = nContactTotals.dailyTotals;
  let ahtDaysForWeek = aHandleTimes.dailyAverages;

  let offeredTotalForWeek = nContactTotals.weeklyTotal;
  let ahtTotalForWeek = aHandleTimes.weeklyAverage;

  // Set forecast data in UI
  updateTotalsTableDiv(
    offeredTotalForWeek,
    ahtTotalForWeek,
    weeklyMode ? offeredDaysForWeek : offeredDaysForWeek[selectedWeekDay],
    weeklyMode ? ahtDaysForWeek : ahtDaysForWeek[selectedWeekDay]
  );

  let { intervals, xAxisLabels } = generateIntervalsAndLabels(weeklyMode);

  let vegaSpec = {
    "$schema": "https://vega.github.io/schema/vega/v5.json",
    "width": 350,
    "height": 360,
    "padding": 5,

    "data": [
      {
        "name": "table",
        "values": intervals.map((x, i) => {
          let y1 = weeklyMode
            ? offeredDaysForWeek[i]
            : offeredIntervalsForDay[i];
          let y2 = weeklyMode ? ahtDaysForWeek[i] : ahtIntervalsForDay[i];

          return { x, y1, y2 };
        }),
      },
    ],

    "scales": [
      {
        "name": "x",
        "type": "band",
        "range": "width",
        "domain": { "data": "table", "field": "x" },
        "padding": 0.1,
      },
      {
        "name": "y",
        "type": "linear",
        "range": "height",
        "nice": true,
        "zero": false,
        "domain": { "data": "table", "field": "y1" },
        "domainMin": 0,
      },
      {
        "name": "y2",
        "type": "linear",
        "range": "height",
        "nice": true,
        "zero": false,
        "domain": { "data": "table", "field": "y2" },
        "domainMin": 0,
      },
    ],

    "axes": [
      {
        "orient": "bottom",
        "scale": "x",
        "labelAngle": -90,
        "labelPadding": 10,
        "title": weeklyMode ? "Days" : "Time (hours)",
        "bandPosition": 0.5, // Center the labels between the ticks
        "labelAlign": "center", // Align labels to the center
        "values": weeklyMode
          ? xAxisLabels
          : Array.from(
              { length: 24 },
              (_, i) => `${i.toString().padStart(2, "0")}:00`
            ),
      },
      { "orient": "left", "scale": "y", "title": "Offered" },
      { "orient": "right", "scale": "y2", "title": "Average Handle Time" },
    ],

    "marks": [
      {
        "type": "rect",
        "from": { "data": "table" },
        "encode": {
          "enter": {
            "x": { "scale": "x", "field": "x" },
            "width": { "scale": "x", "band": 1 },
            "y": { "scale": "y", "field": "y1" },
            "y2": { "scale": "y", "value": 0 },
            "fill": { "value": "rgb(31, 119, 180)" },
          },
        },
      },
      {
        "type": "line",
        "from": { "data": "table" },
        "encode": {
          "enter": {
            "x": { "scale": "x", "field": "x", "band": 0.5 },
            "y": { "scale": "y2", "field": "y2" },
            "stroke": { "value": "rgb(255, 127, 14)" },
          },
        },
      },
      weeklyMode
        ? {
            "type": "symbol",
            "from": { "data": "table" },
            "encode": {
              "enter": {
                "x": { "scale": "x", "field": "x", "band": 0.5 },
                "y": { "scale": "y2", "field": "y2" },
                "fill": { "value": "rgb(255, 127, 14)" },
                "size": { "value": 50 },
              },
            },
          }
        : {
            "type": "symbol",
            "from": { "data": "table" },
            "encode": {
              "enter": {
                "x": { "scale": "x", "field": "x", "band": 0.5 },
                "y": { "scale": "y2", "field": "y2" },
                "fill": { "value": "rgb(255, 127, 14)" },
                "size": { "value": 0 },
              },
            },
          },
    ],
  };

  let view = new vega.View(vega.parse(vegaSpec), {
    renderer: "canvas",
    container: "#chart",
    hover: true,
  });

  // Rotate the daily totals arrays to align to BU start day of week for presentation
  let rotatedOfferedDaysForWeek = rotateArrays(offeredDaysForWeek);
  let rotatedAhtDaysForWeek = rotateArrays(ahtDaysForWeek);

  view
    .change(
      "table",
      vega
        .changeset()
        .remove(() => true)
        .insert(
          intervals.map((x, i) => ({
            x: xAxisLabels[i],
            y1: weeklyMode
              ? rotatedOfferedDaysForWeek[i]
              : offeredIntervalsForDay[i],
            y2: weeklyMode ? rotatedAhtDaysForWeek[i] : ahtIntervalsForDay[i],
          }))
        )
    )
    .run();

  // Unhide the totals table div
  const totalsTableDiv = document.getElementById("totals-table");
  totalsTableDiv.hidden = false;

  let dayTotalFcTrH = document.getElementById("fc-day-tr-heading");
  weeklyMode
    ? (dayTotalFcTrH.innerHTML = "Days")
    : (dayTotalFcTrH.innerHTML = "Day");

  // Unhide the controls div
  const controlsDiv = document.getElementById("controls");
  controlsDiv.hidden = false;

  initializeModificationListeners(data);
}
/* MAIN FUNCTIONS END */

/* HELPER FUNCTIONS START */
// Function to generate intervals and xAxisLabels
function generateIntervalsAndLabels(weeklyMode) {
  let intervals, xAxisLabels;

  if (weeklyMode) {
    // Generate intervals and labels for the week, ignoring "All"
    intervals = Array.from({ length: 7 }, (_, i) => i);
    xAxisLabels = applicationConfig.daysOfWeek
      .filter((day) => day.id !== "99")
      .map((day) => day.name.slice(0, 3)); // Get first 3 characters for short names
  } else {
    // Generate intervals and labels for the day
    intervals = Array.from({ length: 96 }, (_, i) => {
      let hours = Math.floor(i / 4);
      let minutes = (i % 4) * 15;
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`;
    });
    xAxisLabels = intervals;
  }

  return { intervals, xAxisLabels };
}

// Function to set forecast data totals in UI
function updateTotalsTableDiv(offeredWeek, ahtWeek, offeredDay, ahtDay) {
  document.getElementById("fc-week-offered").textContent = parseFloat(
    offeredWeek.toFixed(1)
  ).toLocaleString("en", { minimumFractionDigits: 1 });
  document.getElementById("fc-week-aht").textContent = parseFloat(
    ahtWeek.toFixed(1)
  ).toLocaleString("en", { minimumFractionDigits: 1 });

  if (Array.isArray(offeredDay)) {
    // Rotate the daily totals array to align to BU start day of week for presentation
    let rotatedOfferedDay = rotateArrays(offeredDay);
    document.getElementById("fc-day-offered").innerHTML = rotatedOfferedDay
      .map((day) =>
        parseFloat(day.toFixed(1)).toLocaleString("en", {
          minimumFractionDigits: 1,
        })
      )
      .join("<br>");
  } else if (offeredDay) {
    document.getElementById("fc-day-offered").textContent = parseFloat(
      offeredDay.toFixed(1)
    ).toLocaleString("en", { minimumFractionDigits: 1 });
  }

  if (Array.isArray(ahtDay)) {
    // Rotate the daily totals array to align to BU start day of week for presentation
    let rotatedAhtDay = rotateArrays(ahtDay);
    document.getElementById("fc-day-aht").innerHTML = rotatedAhtDay
      .map((day) =>
        parseFloat(day.toFixed(1)).toLocaleString("en", {
          minimumFractionDigits: 1,
        })
      )
      .join("<br>");
  } else if (ahtDay) {
    document.getElementById("fc-day-aht").textContent = parseFloat(
      ahtDay.toFixed(1)
    ).toLocaleString("en", { minimumFractionDigits: 1 });
  }
}

// Function to extract the non-zero subrange
function extractSubrange(data) {
  // Identify the first and last non-zero indices
  let nonZeroIndices = data
    .map((value, index) => (value !== 0 ? index : -1))
    .filter((index) => index !== -1);
  let start_index = nonZeroIndices[0];
  let end_index = nonZeroIndices[nonZeroIndices.length - 1];

  // Extract the subrange
  let subrange = data.slice(start_index, end_index + 1);

  return { subrange, start_index, end_index };
}

// Function to maintain the original sum
function maintainOriginalSum(modifiedData, originalSum) {
  // Check if modifiedData is a 2D array
  if (Array.isArray(modifiedData[0])) {
    // Calculate the sum of the modified data
    let modifiedSum = modifiedData.flat().reduce((a, b) => a + b, 0);

    // Scale the modified data to maintain the original sum
    if (modifiedSum !== 0) {
      modifiedData = modifiedData.map((subArray) =>
        subArray.map((value) => (value * originalSum) / modifiedSum)
      );
    }
  } else {
    // Calculate the sum of the modified data
    let modifiedSum = modifiedData.reduce((a, b) => a + b, 0);

    // Scale the modified data to maintain the original sum
    if (modifiedSum !== 0) {
      modifiedData = modifiedData.map(
        (value) => (value * originalSum) / modifiedSum
      );
    }
  }

  return modifiedData;
}

// Function to scale 2D array by day
function scale2DArrayByDay(original2DArray, modifiedTotals) {
  // Check if original2DArray is a 2D array
  if (Array.isArray(original2DArray[0])) {
    // Calculate the original totals for each day
    let originalTotals = original2DArray.map((subArray) =>
      subArray.reduce((a, b) => a + b, 0)
    );

    // Scale the values for each day based on the modified totals
    let scaled2DArray = original2DArray.map((subArray, i) => {
      let originalTotal = originalTotals[i];
      let modifiedTotal = modifiedTotals[i];
      if (originalTotal !== 0) {
        return subArray.map((value) => (value * modifiedTotal) / originalTotal);
      } else {
        return subArray;
      }
    });

    return scaled2DArray;
  } else {
    throw new Error("Input is not a 2D array");
  }
}
/* HELPER FUNCTIONS END */

/* MODIFICATION FUNCTIONS START */
// Function to initialize modification listeners
async function initializeModificationListeners(pgFcData) {
  let smoothButton = document.getElementById("smooth-button");
  let normalizeButton = document.getElementById("trendline-button");
  let flattenButton = document.getElementById("flatten-button");
  let resetButton = document.getElementById("reset-button");

  // Clone and replace buttons to remove existing event listeners
  smoothButton = replaceButton(smoothButton);
  normalizeButton = replaceButton(normalizeButton);
  flattenButton = replaceButton(flattenButton);
  resetButton = replaceButton(resetButton);

  smoothButton.addEventListener("click", async () => {
    let modifiedData = await applyModification(pgFcData, smoothData);
    updateModifiedForecast(modifiedData);
    populateGraphAndTable(modifiedData);
  });

  normalizeButton.addEventListener("click", async () => {
    let modifiedData = await applyModification(pgFcData, applyTrendline);
    updateModifiedForecast(modifiedData);
    populateGraphAndTable(modifiedData);
  });

  flattenButton.addEventListener("click", async () => {
    let modifiedData = await applyModification(pgFcData, flattenData);
    updateModifiedForecast(modifiedData);
    populateGraphAndTable(modifiedData);
  });

  resetButton.addEventListener("click", async () => {
    let resetData = await reset(pgFcData);
    updateModifiedForecast(resetData);
    populateGraphAndTable(resetData);
  });
}

// Function to replace buttons
function replaceButton(oldButton) {
  const newButton = oldButton.cloneNode(true);
  oldButton.parentNode.replaceChild(newButton, oldButton);
  return document.getElementById(newButton.id);
}

// Function to apply modifications
async function applyModification(data, modToRun) {
  const metricSelect = document.getElementById("metric-select").value;
  let modifiedData = { ...data };
  const weeklyMode = data.selectedWeekDay === "99";
  let selectedWeekDay = Number(data.selectedWeekDay);
  let nContacts = modifiedData.fcValues.nContacts;
  let nHandled = modifiedData.fcValues.nHandled;
  let tHandle = modifiedData.fcValues.tHandle;

  // Calculate totals
  let { dailyTotals: nContactsDailyTotals, weeklyTotal: nContactsWeeklyTotal } =
    calculateTotals(nContacts);
  let { dailyTotals: nHandledDailyTotals, weeklyTotal: nHandledWeeklyTotal } =
    calculateTotals(nHandled);
  let { dailyTotals: tHandleDailyTotals, weeklyTotal: tHandleWeeklyTotal } =
    calculateTotals(tHandle);

  if (weeklyMode) {
    // Modify daily totals over full week
    let modifiedTotals;

    if (metricSelect === "offered" || metricSelect === "both") {
      console.debug(
        `[OFG.MODIFICATIONS] Modifying Offered with ${modToRun.name}`,
        nContactsDailyTotals
      );
      try {
        // Run modification function on nContacts
        modifiedTotals = modToRun(nContactsDailyTotals);

        // Maintain the original sum
        modifiedTotals = maintainOriginalSum(
          modifiedTotals,
          nContactsWeeklyTotal
        );

        // Scale the values for each day based on the modified totals
        let modifiedValues = scale2DArrayByDay(nContacts, modifiedTotals);

        // Replace the original values with the modified values
        modifiedData.fcValues.nContacts = modifiedValues;
      } catch (error) {
        throw new Error("Error modifying Offered data", error);
      }
    }

    if (metricSelect === "aver-handle-time" || metricSelect === "both") {
      console.debug(
        `[OFG.MODIFICATIONS] Modifying AHT with ${modToRun.name}`,
        nContactsDailyTotals
      );

      try {
        // Run modification function on nHandled
        modifiedTotals = modToRun(nHandledDailyTotals);

        // Scale the values for each day based on the modified totals
        let modifiedValues = scale2DArrayByDay(nHandled, modifiedTotals);

        // Replace the original values with the modified values
        modifiedData.fcValues.nHandled = modifiedValues;

        // Run modification function on tHandle
        modifiedTotals = modToRun(tHandleDailyTotals);

        // Scale the values for each day based on the modified totals
        modifiedValues = scale2DArrayByDay(tHandle, modifiedTotals);

        // Replace the original values with the modified values
        modifiedData.fcValues.tHandle = modifiedValues;
      } catch (error) {
        throw new Error("Error modifying AHT data", error);
      }
    }
  } else {
    // Modify intraday values for selected week day
    let modifiedValues;
    if (metricSelect === "offered" || metricSelect === "both") {
      // Run modification function on nContacts
      modifiedValues = modToRun(nContacts[selectedWeekDay]);

      // Maintain the original sum
      modifiedValues = maintainOriginalSum(
        modifiedValues,
        nContactsDailyTotals[selectedWeekDay]
      );

      // Replace the original values with the modified values
      modifiedData.fcValues.nContacts[selectedWeekDay] = modifiedValues;
    }

    if (metricSelect === "aver-handle-time" || metricSelect === "both") {
      // Run modification function on nHandled
      modifiedValues = modToRun(nHandled[selectedWeekDay]);

      /*
      // Not currently being used for AHT mods - totals should be impacted... allow user to specify?
      // Maintain the original sums
      modifiedValues = maintainOriginalSum(
        modifiedValues,
        nHandledDailyTotals[selectedWeekDay]
      );
      */

      // Replace the original values with the modified values
      modifiedData.fcValues.nHandled[selectedWeekDay] = modifiedValues;

      // Run modification function on tHandle
      modifiedValues = modToRun(tHandle[selectedWeekDay]);

      /*
      // Not currently being used for AHT mods - totals should be impacted... allow user to specify?
      // Maintain the original sums
      modifiedValues = maintainOriginalSum(
        modifiedValues,
        tHandleDailyTotals[selectedWeekDay]
      );
      */

      // Replace the original values with the modified values
      modifiedData.fcValues.tHandle[selectedWeekDay] = modifiedValues;
    }
  }

  return modifiedData;
}

// Function to smooth data
function smoothData(data) {
  // Extract the subrange of non-zero values for the selected weekday
  let { subrange, start_index, end_index } = extractSubrange(data);

  // Smooth the subrange
  let smoothedSubrange = subrange.map((num, i, arr) => {
    // Ignore zero values
    if (num === 0) return 0;

    // Use two point moving average for smoothing first and last elements
    if (i === 0) return Math.max(0, (num + arr[i + 1]) / 2);
    if (i === arr.length - 1) return Math.max(0, (arr[i - 1] + num) / 2);

    // Use three point moving average for smoothing middle elements
    return Math.max(0, (arr[i - 1] + num + arr[i + 1]) / 3);
  });

  // Replace the subrange in the original data for the selected weekday
  let smoothedData = [...data];
  for (let i = start_index; i <= end_index; i++) {
    smoothedData[i] = smoothedSubrange[i - start_index];
  }

  return smoothedData;
}

// Function to calculate the trendline using linear regression
function calculateTrendlineLinearRegression(data) {
  // Extract the subrange of non-zero values
  let { subrange, start_index, end_index } = extractSubrange(data);

  let xSum = 0,
    ySum = 0,
    xySum = 0,
    xSqSum = 0;
  for (let i = start_index; i <= end_index; i++) {
    xSum += i;
    ySum += subrange[i - start_index];
    xySum += i * subrange[i - start_index];
    xSqSum += i * i;
  }

  let n = end_index - start_index + 1;
  let slope = (n * xySum - xSum * ySum) / (n * xSqSum - xSum * xSum);
  let yIntercept = (ySum - slope * xSum) / n;

  return { slope, yIntercept };
}

// Function to apply the trendline to the data
function applyTrendline(data) {
  // Extract the subrange of non-zero values
  let { subrange, start_index, end_index } = extractSubrange(data);

  let { slope, yIntercept } = calculateTrendlineLinearRegression(data);
  let trendline = subrange.map((value, i) =>
    value !== 0 ? slope * (i + start_index) + yIntercept : 0
  );

  // Insert the trendline back into the original data
  for (let i = start_index; i <= end_index; i++) {
    data[i] = trendline[i - start_index];
  }

  return data;
}

// Function to flatten data
function flattenData(data) {
  // Extract the subrange of non-zero values
  let { subrange, start_index, end_index } = extractSubrange(data);

  // Calculate the total and average of the non-zero values
  let total = subrange.reduce((a, b) => a + b, 0);

  let flattenedSubrange = subrange.map((value) => {
    return value !== 0 ? total : 0;
  });

  let flattenedData = [...data];
  for (let i = start_index; i <= end_index; i++) {
    flattenedData[i] = flattenedSubrange[i - start_index];
  }

  return flattenedData;
}

// Function to reset data
async function reset(data) {
  let modifiedData = { ...data };

  // Get a deep copy of the original data
  let originalData = JSON.parse(
    JSON.stringify(await getSelectedPgForecastData("generatedForecast"))
  );

  let originalFcValues = originalData.fcValues;
  let nContacts = originalFcValues.nContacts;
  let nHandled = originalFcValues.nHandled;
  let tHandle = originalFcValues.tHandle;

  // Define the reset data object
  let resetData = {};
  resetData.selectedPgId = originalData.selectedPgId;
  resetData.selectedWeekDay = originalData.selectedWeekDay;
  let resetFcValue = (resetData.fcValues = {});

  // Get the weekly mode and selected week day
  const weeklyMode = originalData.selectedWeekDay === "99";
  let selectedWeekDay = Number(originalData.selectedWeekDay);

  // Get the metric select value
  const metricSelect = document.getElementById("metric-select").value;

  if (metricSelect === "offered" || metricSelect === "both") {
    resetFcValue.nContacts = weeklyMode
      ? nContacts
      : nContacts.map((day, index) =>
          index === selectedWeekDay ? nContacts[selectedWeekDay] : day
        );
  }
  if (metricSelect === "aver-handle-time" || metricSelect === "both") {
    resetFcValue.nHandled = weeklyMode
      ? nHandled
      : nHandled.map((day, index) =>
          index === selectedWeekDay ? nHandled[selectedWeekDay] : day
        );
    resetFcValue.tHandle = weeklyMode
      ? tHandle
      : tHandle.map((day, index) =>
          index === selectedWeekDay ? tHandle[selectedWeekDay] : day
        );
  }

  // Merge the resetData with the modifiedData
  resetData = {
    ...modifiedData,
    fcValues: { ...modifiedData.fcValues, ...resetData.fcValues },
  };
  return resetData;
}

// Function to update shared state
function updateModifiedForecast(modifiedData) {
  let selectedPgId = modifiedData.selectedPgId;
  let selectedWeekDay = modifiedData.selectedWeekDay;

  // Get the metric select value
  const metricSelect = document.getElementById("metric-select").value;

  // Set weekly mode
  const weeklyMode = selectedWeekDay === "99";

  // Find the index of the selected planning group in the modified forecast
  let index;
  let modifiedPgForecast;
  try {
    index = applicationState.forecastOutputs.modifiedForecast.findIndex(
      (group) => group.planningGroup.id === selectedPgId
    );
    modifiedPgForecast =
      applicationState.forecastOutputs.modifiedForecast[index];
  } catch (error) {
    console.error("[OFG] Planning group not found in modified forecast", error);
    throw error;
  }

  // Update the shared state with the modified data
  if (metricSelect === "offered" || metricSelect === "both") {
    let nContactsModified = modifiedData.fcValues.nContacts;
    if (weeklyMode) {
      modifiedPgForecast.forecastData.nContacts = nContactsModified.map(
        (day, i) => {
          return [...modifiedPgForecast.forecastData.nContacts[i], ...day];
        }
      );
    } else {
      modifiedPgForecast.forecastData.nContacts[selectedWeekDay] =
        nContactsModified[selectedWeekDay];
    }
  }
  if (metricSelect === "aver-handle-time" || metricSelect === "both") {
    let nHandledModified = modifiedData.fcValues.nHandled;
    let tHandleModified = modifiedData.fcValues.tHandle;
    if (weeklyMode) {
      modifiedPgForecast.forecastData.nHandled = nHandledModified.map(
        (day, i) => {
          return [...modifiedPgForecast.forecastData.nHandled[i], ...day];
        }
      );
      modifiedPgForecast.forecastData.tHandle = tHandleModified.map(
        (day, i) => {
          return [...modifiedPgForecast.forecastData.tHandle[i], ...day];
        }
      );
    } else {
      modifiedPgForecast.forecastData.nHandled[selectedWeekDay] = [
        ...modifiedPgForecast.forecastData.nHandled[selectedWeekDay],
        ...nHandledModified[selectedWeekDay],
      ];
      modifiedPgForecast.forecastData.tHandle[selectedWeekDay] = [
        ...modifiedPgForecast.forecastData.tHandle[selectedWeekDay],
        ...tHandleModified[selectedWeekDay],
      ];
    }
  }
}
/* MODIFICATION FUNCTIONS END */

/* ADDITIONAL FUTURE FUNCTIONS START */
// Function to calculate the slope and y-intercept of the trendline using robust regression
function calculateTrendlineRobustRegression(data) {
  // Extract the subrange of non-zero values
  let { subrange, start_index, end_index } = extractSubrange(data);

  let xSum = 0,
    ySum = 0,
    xySum = 0,
    xSqSum = 0;
  for (let i = start_index; i <= end_index; i++) {
    let x = i;
    let y = subrange[i - start_index];
    xSum += x;
    ySum += y;
    xySum += x * y;
    xSqSum += x * x;
  }

  let n = end_index - start_index + 1;
  let slope = (n * xySum - xSum * ySum) / (n * xSqSum - xSum * xSum);
  let yIntercept = (ySum - slope * xSum) / n;

  return { slope, yIntercept };
}

// Function to normalize data with dynamic clipping
function clipData(data, clipPercent = 0.1) {
  // Extract the subrange of non-zero values
  let { subrange, start_index, end_index } = extractSubrange(data);

  // Calculate dynamic clipping thresholds
  let maxValue = Math.max(...subrange);
  let minValue = Math.min(...subrange);
  let range = maxValue - minValue;
  let lowerBound = minValue + clipPercent * range;
  let upperBound = maxValue - clipPercent * range;

  // Clip data
  let normalizedData = subrange.map((num) => {
    if (num < lowerBound) return lowerBound;
    if (num > upperBound) return upperBound;
    return num;
  });

  // Insert the normalized data back into the original data
  for (let i = start_index; i <= end_index; i++) {
    data[i] = normalizedData[i - start_index];
  }

  return data;
}

// Function to normalize data with IQR
function normalizeData(data) {
  // Extract the subrange of non-zero values
  let { subrange, start_index, end_index } = extractSubrange(data);
  console.log("subrange:", subrange);

  // Calculate thresholds for peaks and troughs based on IQR
  let sortedSubrange = [...subrange].sort((a, b) => a - b);
  let q1 = sortedSubrange[Math.floor(sortedSubrange.length * 0.25)];
  let q3 = sortedSubrange[Math.floor(sortedSubrange.length * 0.75)];
  let iqr = q3 - q1;
  let lowerBound = Math.max(0, q1 - 1.5 * iqr); // Adjust lower bound to be 0 if it's negative
  let upperBound = q3 + 1.5 * iqr;
  console.log("lowerBound:", lowerBound);
  console.log("upperBound:", upperBound);

  // Trim peaks and uplift troughs
  let adjustedSubrange = subrange.map((num) => {
    if (num < lowerBound) return lowerBound;
    if (num > upperBound) return upperBound;
    return num;
  });

  // Replace the subrange in the original data
  let normalisedData = [...data];
  for (let i = start_index; i <= end_index; i++) {
    normalisedData[i] = adjustedSubrange[i - start_index];
  }

  return normalisedData;
}
/* ADDITIONAL FUTURE FUNCTIONS END */
