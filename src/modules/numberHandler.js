// numberHandler.js
// Description: Utility functions for handling and calculating number data

// Global variables
("use strict");

// Function to calculate totals
export function calculateTotals(data) {
  let dailyTotals = [];
  let weeklyTotal = 0;

  for (let i = 0; i < data.length; i++) {
    let day = data[i];
    let dailyTotal = 0;

    for (let j = 0; j < day.length; j++) {
      let interval = day[j];
      dailyTotal += interval;
    }

    dailyTotals.push(dailyTotal);
    weeklyTotal += dailyTotal;
  }

  return {
    dailyTotals,
    weeklyTotal,
  };
}

// Function to calculate averages
export function calculateWeightedAverages(data, weights) {
  let intervalAverages = Array(7)
    .fill()
    .map(() => Array(96).fill(0));
  let dailyAverages = [];
  let weeklyAverage = 0;

  let dataTotals = calculateTotals(data);
  let dailyTotals = dataTotals.dailyTotals;
  let weeklyTotal = dataTotals.weeklyTotal;

  let weightsTotals = calculateTotals(weights);
  let dailyWeights = weightsTotals.dailyTotals;
  let weeklyWeight = weightsTotals.weeklyTotal;

  // Calculate intraday averages using flatmap
  intervalAverages = data.map((day, i) => {
    return day.map((interval, j) => {
      let normalizedWeight = weights[i][j] !== 0 ? weights[i][j] : 1;
      return interval / normalizedWeight;
    });
  });

  // Calculate daily averages
  dailyAverages = dailyTotals.map((total, i) => {
    return dailyWeights[i] !== 0 ? total / dailyWeights[i] : 0;
  });

  // Calculate weekly average
  weeklyAverage = weeklyTotal / weeklyWeight;

  return {
    intervalAverages,
    dailyAverages,
    weeklyAverage,
  };
}

// Function to calculate AHT and totals
export function calculateAhtAndTotals(data, weights) {
  let dailyTotals = [];
  let weeklyTotal = 0;
  let intervalAverages = Array(7)
    .fill()
    .map(() => Array(96).fill(0));
  let dailyAverages = [];
  let weeklyWeightedTotal = 0;
  let totalWeights = 0;

  for (let i = 0; i < data.length; i++) {
    let day = data[i];
    let dailyTotal = 0;
    let dailyWeightedTotal = 0;

    for (let j = 0; j < day.length; j++) {
      let interval = day[j];
      dailyTotal += interval;
      if (weights) {
        dailyWeightedTotal += interval * weights[i][j];
        totalWeights += weights[i][j];
      } else {
        dailyWeightedTotal += day.length !== 0 ? interval / day.length : 0;
      }
      intervalAverages[i][j] = day.length !== 0 ? dailyTotal / day.length : 0;
    }

    dailyTotals.push(dailyTotal);
    weeklyTotal += dailyTotal;

    if (weights) {
      let weightSum = weights[i].reduce((total, weight) => total + weight, 0);
      dailyAverages.push(weightSum !== 0 ? dailyWeightedTotal / weightSum : 0);
      weeklyWeightedTotal += dailyWeightedTotal;
    } else {
      dailyAverages.push(day.length !== 0 ? dailyTotal / day.length : 0);
      weeklyWeightedTotal += dailyWeightedTotal;
    }
  }

  let weeklyAverage =
    totalWeights !== 0 ? weeklyWeightedTotal / totalWeights : 0;

  return {
    dailyTotals,
    weeklyTotal,
    intervalAverages,
    dailyAverages,
    weeklyAverage,
  };
}

// Function to calculate totals for a week
export async function distributeDataOverWeek(
  total,
  originalData,
  distribution
) {
  let distributedDataIntraday = [];

  // Use calculateTotals to get the total data per week
  let { weeklyTotal: totalDataPerWeek } = calculateTotals(originalData);

  for (let i = 0; i < distribution.length; i++) {
    let crDistribDay = distribution[i];
    let originalDataDay = originalData[i];

    // Use calculateTotals to get the total data per day
    let { dailyTotals: totalDataPerDay } = calculateTotals([originalDataDay]);

    let proportionOfDay = totalDataPerDay[0] / totalDataPerWeek;

    // Distribute the data proportionally across the days
    let dataToDistrib = Math.round(total * proportionOfDay);

    let distributedData = await distributeData(dataToDistrib, crDistribDay);
    distributedDataIntraday.push(distributedData);
  }

  return distributedDataIntraday;
}

// Function to distribute data over a given distribution
async function distributeData(data, distribution) {
  let distributedData = [];
  let sumOfDistribution = distribution.reduce((a, b) => {
    if (typeof a !== "number" || typeof b !== "number") {
      throw new Error(`[OFG.NUMBERS] Invalid distribution value: ${a} or ${b}`);
    }
    return a + b;
  }, 0);

  if (sumOfDistribution === 0) {
    return distribution.map(() => 0);
  }

  for (let i = 0; i < distribution.length; i++) {
    if (typeof distribution[i] !== "number") {
      throw new Error(
        `[OFG.NUMBERS] Invalid distribution value: ${distribution[i]}`
      );
    }
    distributedData.push((data * distribution[i]) / sumOfDistribution);
  }
  return distributedData;
}

// Function to prepare metrics used in forecasting
export async function prepFcMetrics(group) {
  const cpId = group.campaign.id;
  const pgName = group.planningGroup.name;

  // Extract historicalWeeks from the group
  var historicalWeeks = group.historicalWeeks;

  // Function to calculate contact rate
  function calculateContactRate(attempted, connected) {
    // Initialize array to store calculated values
    var crValues = [];

    // Calculate contact rate for each pair of attempted and connected values
    for (var i = 0; i < attempted.length; i++) {
      var nAttemptedValue = attempted[i];
      var nConnectedValue = connected[i];

      // Initialize array to store calculated values for each day
      var dailyCrValues = [];

      for (var j = 0; j < nAttemptedValue.length; j++) {
        if (nAttemptedValue[j] === 0) {
          dailyCrValues.push(0);
        } else {
          dailyCrValues.push(nConnectedValue[j] / nAttemptedValue[j]);
        }
      }

      crValues.push(dailyCrValues);
    }

    // Return array of calculated values
    return crValues;
  }

  // Process each week in the historicalWeeks
  for (let w = 0; w < historicalWeeks.length; w++) {
    // Check if the week contains intradayValues
    if (!historicalWeeks[w] || !historicalWeeks[w].intradayValues) {
      console.error(
        `[OFG.NUMBERS] [${pgName}] Intraday values are required in the input object`,
        group
      );
      return;
    }

    let intraday = historicalWeeks[w].intradayValues;

    // Calculate contact rate for intraday data
    const intradayPromise = new Promise((resolve) => {
      intraday.rContact = calculateContactRate(
        intraday.nAttempted,
        intraday.nConnected
      );

      resolve();
    });

    // Wait for the calculation to complete
    await intradayPromise;
  }

  console.debug(`[OFG.NUMBERS] [${pgName}] Contact rates calcuated`);

  // Return the processed group
  return group;
}

// Function to build average values as forecast data
export async function generateAverages(group, ignoreZeroes = true) {
  const campaignPgName = group.planningGroup.name;

  function normalizeToDistribution(array) {
    var totalSum = array.reduce((total, value) => total + value, 0);
    if (totalSum === 0) {
      return array.map(() => 0);
    } else {
      return array.map((value) => value / totalSum);
    }
  }

  const metrics = [
    "rContact",
    "nAttempted",
    "nConnected",
    "nHandled",
    "tHandle",
  ];

  metrics.forEach((metric) => {
    let totalMetricIntraday = Array(7)
      .fill()
      .map(() => Array(96).fill(0));
    let countMetricIntraday = Array(7)
      .fill()
      .map(() => Array(96).fill(0));

    group.historicalWeeks.forEach((week) => {
      week.intradayValues[metric].forEach((day, i) => {
        const daySum = day.reduce((total, value) => total + value, 0);

        if (ignoreZeroes && daySum === 0) {
          return;
        }

        day.forEach((value, j) => {
          totalMetricIntraday[i % 7][j] += value;
          countMetricIntraday[i % 7][j] += 1;
        });
      });
    });

    group.forecastData[`${metric}`] = totalMetricIntraday.map((day, i) => {
      return day.map((value, j) => {
        return countMetricIntraday[i][j] === 0
          ? 0
          : value / countMetricIntraday[i][j];
      });
    });

    if (metric === "rContact") {
      group.forecastData[`${metric}AverageDistrib`] = group.forecastData[
        `${metric}`
      ].map(normalizeToDistribution);
    }
  });

  console.debug(`[OFG.NUMBERS] [${campaignPgName}] Averages generated`);

  return group;
}

// Function to apply user supplied number of contacts to the forecast
export async function applyContacts(group) {
  const campaignPgName = group.planningGroup.name;
  const groupFcData = group.forecastData;
  const rContactAverageDistrib = groupFcData.rContactAverageDistrib;
  const rContactAverage = groupFcData.rContact;
  const campaignContacts = group.metadata.numContacts;

  groupFcData.nContacts = await distributeDataOverWeek(
    campaignContacts,
    rContactAverage,
    rContactAverageDistrib
  );

  console.debug(
    `[OFG.NUMBERS] [${campaignPgName}] Applied ${campaignContacts} contacts`
  );

  return group;
}

// Function to resolve AHT values to contacts
export async function resolveContactsAht(campaignData, resolveContactsAht) {
  // TODO: This needs attention... it's not currently being used - do I need it?

  const campaignPgName = campaignData.planningGroup.name;

  if (resolveContactsAht) {
    console.log(
      `[OFG.NUMBERS] [${campaignPgName}] Resolving AHT values for contacts.`
    );
    const nContacts = campaignData.fcData.nContacts;
    let tHandle = campaignData.fcData.tHandle;

    // Calculate daily totals
    const { dailyTotals } = calculateTotals(tHandle);

    // Ensure every interval in nContacts has a respective value in ahtIntraday if user elects
    nContacts.forEach((day, i) => {
      day.forEach((interval, j) => {
        if (
          interval !== 0 &&
          (tHandle[i][j] === 0 || tHandle[i][j] === undefined)
        ) {
          console.debug(
            `[OFG.NUMBERS] [${campaignPgName}] Day ${i}, interval ${j} has contacts but no AHT value. Populating daily AHT value of ${dailyTotals[i]}.`
          );
          tHandle[i][j] = dailyTotals[i];
        }
      });
    });

    // Set any interval with 0 contacts to 0 AHT
    nContacts.forEach((day, i) => {
      day.forEach((interval, j) => {
        if (interval === 0 && tHandle[i][j] !== 0) {
          console.debug(
            `[OFG.NUMBERS] [${campaignPgName}] Day ${i}, interval ${j} has 0 contacts but AHT of ${tHandle[i][j]}. Setting AHT to 0.`
          );
          tHandle[i][j] = 0;
        }
      });
    });

    // Redistribute the total handle times across the day
    const totalHandleTime = tHandle.reduce(
      (a, b) => a + b.reduce((c, d) => c + d, 0),
      0
    );
    tHandle = await distributeDataOverWeek(totalHandleTime, tHandle, nContacts);
  }

  console.debug(
    `[OFG.NUMBERS] [${campaignPgName}] AHT resolved to contacts.`,
    JSON.parse(JSON.stringify(campaignData))
  );

  // Return the modified campaignData object
  return campaignData;
}
