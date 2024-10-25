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
const dayNames = applicationConfig.daysOfWeek
  .filter((day) => day.id !== "99")
  .map((day) => day.name.slice(0, 3));

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

let vegaView;
const vegaSpec = {
  "$schema": "https://vega.github.io/schema/vega/v5.json",
  "width": 300,
  "height": 300,
  "padding": 5,
  "autosize": { "type": "pad", "resize": true, "contains": "padding" },
  "signals": [
    {
      "name": "xAxisTitle",
      "value": "Hour",
    },
    {
      "name": "xAxisLabels",
      "value": [
        "00:00",
        "01:00",
        "02:00",
        "03:00",
        "04:00",
        "05:00",
        "06:00",
        "07:00",
        "08:00",
        "09:00",
        "10:00",
        "11:00",
        "12:00",
        "13:00",
        "14:00",
        "15:00",
        "16:00",
        "17:00",
        "18:00",
        "19:00",
        "20:00",
        "21:00",
        "22:00",
        "23:00",
      ],
    },
    {
      "name": "yAxisTitle",
      "value": "Offered",
    },
    {
      "name": "y2AxisTitle",
      "value": "Average Handle Time",
    },
  ],
  "data": [
    {
      "name": "table",
      "values": [],
    },
  ],
  "scales": [
    {
      "name": "x",
      "type": "band",
      "domain": { "data": "table", "field": "x" },
      "range": "width",
    },
    {
      "name": "y",
      "type": "linear",
      "domain": { "data": "table", "field": "y1" },
      "range": "height",
    },
    {
      "name": "y2",
      "type": "linear",
      "domain": { "data": "table", "field": "y2" },
      "range": "height",
    },
    {
      "name": "color",
      "type": "ordinal",
      "domain": { "data": "table", "field": "c" },
      "range": { "scheme": "category10" },
    },
  ],
  "axes": [
    {
      "orient": "bottom",
      "scale": "x",
      "labelAngle": 0,
      "labelPadding": 10,
      "labelBound": false,
      "labelOverlap": "greedy",
      "title": { "signal": "xAxisTitle" },
      "bandPosition": 0,
      "labelAlign": "center",
      "values": { "signal": "xAxisLabels" },
      "grid": true,
    },
    {
      "orient": "left",
      "scale": "y",
      "title": { "signal": "yAxisTitle" },
      "format": "~s",
    },
    {
      "orient": "right",
      "scale": "y2",
      "title": { "signal": "y2AxisTitle" },
      "format": "~s",
    },
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
  ],
};

function initializeVegaChart() {
  vegaView = new vega.View(vega.parse(vegaSpec), {
    renderer: "svg",
    container: "#chart",
    hover: true,
  }).run();
}

function updateVegaChart(data, weeklyMode, xAxisLabels) {
  const {
    intervals,
    offeredIntervalsForDay,
    ahtIntervalsForDay,
    offeredDaysForWeek,
    ahtDaysForWeek,
  } = data;

  // Rotate the daily totals arrays to align to BU start day of week for presentation
  let rotatedOfferedDaysForWeek = rotateArrays(offeredDaysForWeek);
  let rotatedAhtDaysForWeek = rotateArrays(ahtDaysForWeek);

  // Update the x-axis values
  if (weeklyMode) {
    console.log("[OFG.MODIFICATIONS] Weekly mode: Show day names", xAxisLabels);

    // Weekly mode: Show day names
    vegaView.signal("xAxisTitle", "Days").run();
    vegaView.signal("xAxisLabels", xAxisLabels).run();
  } else {
    // Daily mode: Show only every hour
    const hourlyLabels = Array.from(
      { length: 24 },
      (_, i) => `${i.toString().padStart(2, "0")}:00`
    );
    vegaView.signal("xAxisTitle", "Time (hours)").run();
    vegaView.signal("xAxisLabels", hourlyLabels).run();
    console.log(
      "[OFG.MODIFICATIONS] Daily mode: Show hourly labels",
      hourlyLabels
    );
  }

  // Update the y-axis values
  vegaView.signal("yAxisTitle", "Offered");
  vegaView.signal("y2AxisTitle", "Average Handle Time");

  // Run all signals
  vegaView.run();

  // Log the transformed data to the console
  const transformedData = intervals.map((x, i) => {
    let y1 = weeklyMode
      ? rotatedOfferedDaysForWeek[i]
      : offeredIntervalsForDay[i] || 0;
    let y2 = weeklyMode ? rotatedAhtDaysForWeek[i] : ahtIntervalsForDay[i] || 0;

    // Use xAxisLabels for x value
    let xValue = xAxisLabels[i];

    return { x: xValue, y1, y2 };
  });

  console.log("[OFG.MODIFICATIONS] Transformed data:", transformedData);

  vegaView
    .change(
      "table",
      vega
        .changeset()
        .remove(() => true)
        .insert(transformedData)
    )
    .run();
}

// Function to populate the UI data
export async function populateGraphAndTable(data) {
  let { selectedPgId, selectedWeekDay, fcValues } = data;

  if (selectedWeekDay !== undefined) {
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
      offeredIntervalsForDay = nContacts[selectedWeekDay] || [];
      ahtIntervalsForDay = aHandleTimes.intervalAverages[selectedWeekDay] || [];
    }

    // Set daily & weekly level values
    let offeredDaysForWeek = nContactTotals.dailyTotals;
    let ahtDaysForWeek = aHandleTimes.dailyAverages;

    let offeredTotalForWeek = nContactTotals.weeklyTotal;
    let ahtTotalForWeek = aHandleTimes.weeklyAverage;

    // Set forecast data in UI
    updateTotalsTableDiv(
      selectedWeekDay,
      offeredTotalForWeek,
      ahtTotalForWeek,
      weeklyMode ? offeredDaysForWeek : offeredDaysForWeek[selectedWeekDay],
      weeklyMode ? ahtDaysForWeek : ahtDaysForWeek[selectedWeekDay]
    );

    let { intervals, xAxisLabels } = generateIntervalsAndLabels(weeklyMode);

    // Update the Vega chart with new data
    updateVegaChart(
      {
        intervals,
        offeredIntervalsForDay,
        ahtIntervalsForDay,
        offeredDaysForWeek,
        ahtDaysForWeek,
      },
      weeklyMode,
      xAxisLabels
    );

    // Unhide the totals table div
    const totalsTableDiv = document.getElementById("totals-table");
    totalsTableDiv.hidden = false;

    // Unhide the controls div
    const controlsDiv = document.getElementById("controls");
    controlsDiv.hidden = false;

    initializeModificationListeners(data);
  }
}

// Initialize the Vega chart on page load
document.addEventListener("DOMContentLoaded", () => {
  initializeVegaChart();
});

// Initialize the Vega chart on page load
document.addEventListener("DOMContentLoaded", () => {
  initializeVegaChart();
});
/* MAIN FUNCTIONS END */

/* HELPER FUNCTIONS START */
// Function to generate intervals and day name labels
function generateIntervalsAndLabels(weeklyMode) {
  let intervals, xAxisLabels;

  if (weeklyMode) {
    // Generate intervals and labels for the week, ignoring "All"
    intervals = Array.from({ length: 7 }, (_, i) => i);
    xAxisLabels = dayNames;
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
function updateTotalsTableDiv(
  selectedWeekDay,
  offeredWeek,
  ahtWeek,
  offeredDay,
  ahtDay
) {
  document.getElementById("fc-week-offered").textContent = parseFloat(
    offeredWeek.toFixed(1)
  ).toLocaleString("en", { minimumFractionDigits: 1 });
  document.getElementById("fc-week-aht").textContent = parseFloat(
    ahtWeek.toFixed(1)
  ).toLocaleString("en", { minimumFractionDigits: 1 });

  const weeklyMode = selectedWeekDay === "99";

  if (weeklyMode) {
    // Rotate the daily totals array to align to BU start day of week for presentation
    let rotatedOfferedDay = rotateArrays(offeredDay);
    let rotatedAhtDay = rotateArrays(ahtDay);

    document.getElementById("fc-day-offered").innerHTML = rotatedOfferedDay
      .map((day) =>
        parseFloat(day.toFixed(1)).toLocaleString("en", {
          minimumFractionDigits: 1,
        })
      )
      .join("<br>");

    document.getElementById("fc-day-aht").innerHTML = rotatedAhtDay
      .map((day) =>
        parseFloat(day.toFixed(1)).toLocaleString("en", {
          minimumFractionDigits: 1,
        })
      )
      .join("<br>");

    document.getElementById("fc-day-names").innerHTML = dayNames.join("<br>");
  } else {
    const dayName = applicationConfig.daysOfWeek.find(
      (day) => day.id === selectedWeekDay
    )?.name;
    document.getElementById("fc-day-offered").textContent = parseFloat(
      offeredDay.toFixed(1)
    ).toLocaleString("en", { minimumFractionDigits: 1 });
    document.getElementById("fc-day-aht").textContent = parseFloat(
      ahtDay.toFixed(1)
    ).toLocaleString("en", { minimumFractionDigits: 1 });
    document.getElementById("fc-day-names").textContent = dayName;
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

      // Replace the original values with the modified values
      modifiedData.fcValues.nHandled[selectedWeekDay] = modifiedValues;

      // Run modification function on tHandle
      modifiedValues = modToRun(tHandle[selectedWeekDay]);

      // Replace the original values with the modified values
      modifiedData.fcValues.tHandle[selectedWeekDay] = modifiedValues;
    }
  }

  return modifiedData;
}

// Function to smooth data
function smoothData(data) {
  console.debug("[OFG.TEMP] Smoothing data", data);
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

  console.debug("[OFG.TEMP] Smoothed data", smoothedData);
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
      modifiedPgForecast.forecastData.nContacts = nContactsModified;
    } else {
      modifiedPgForecast.forecastData.nContacts[selectedWeekDay] =
        nContactsModified[selectedWeekDay];
    }
  }
  if (metricSelect === "aver-handle-time" || metricSelect === "both") {
    let nHandledModified = modifiedData.fcValues.nHandled;
    let tHandleModified = modifiedData.fcValues.tHandle;
    if (weeklyMode) {
      modifiedPgForecast.forecastData.nHandled = nHandledModified;
      modifiedPgForecast.forecastData.tHandle = tHandleModified;
    } else {
      modifiedPgForecast.forecastData.nHandled[selectedWeekDay] =
        nHandledModified[selectedWeekDay];
      modifiedPgForecast.forecastData.tHandle[selectedWeekDay] =
        tHandleModified[selectedWeekDay];
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
