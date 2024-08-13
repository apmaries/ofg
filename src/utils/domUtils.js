// domUtils.js
// Description: Utility functions for DOM manipulation

// Shared state modules
import { applicationConfig } from "../core/configManager.js";
import { applicationState } from "../core/stateManager.js";

// Global variables
("use strict");

// Function to get the value of a radio button group
export function getRadioValue(ele) {
  for (let i = 0; i < ele.length; i++) {
    if (ele[i].checked) {
      return ele[i].value;
    }
  }
}

// Function to hide loading spinner and show content
export async function hideLoadingSpinner(elem, spinner) {
  const elemElem = document.getElementById(elem);
  const spinnerElem = document.getElementById(spinner);

  elemElem.style.display = "block";
  spinnerElem.style.display = "none";
}

// Function to hide loading spinner and show content
export async function resetLoadingSpinner(elem, spinner) {
  const elemElem = document.getElementById(elem);
  const spinnerElem = document.getElementById(spinner);

  elemElem.style.display = "none";
  spinnerElem.style.display = "block";
}

// Function to replace the text in loading message
export async function updateLoadingMessage(elem, message) {
  const loadingMessage = document.getElementById(elem);
  loadingMessage.innerHTML = message;
}

// Function to populate dropdowns with provided data
export function populateDropdown(
  listbox,
  data,
  sortAttribute = "name",
  applySort = true
) {
  // Remove existing listbox items
  while (listbox.firstChild) {
    listbox.removeChild(listbox.firstChild);
  }

  return new Promise((resolve, reject) => {
    try {
      if (data.length === 0) {
        listbox.innerHTML = '<gux-option value="">No data found</gux-option>';
        resolve();
        return;
      }

      // Check if sorting should be applied
      if (applySort) {
        if (typeof data[0] === "object" && sortAttribute) {
          // sort data by sortAttribute (not case sensitive)
          data.sort((a, b) =>
            a[sortAttribute].localeCompare(b[sortAttribute], undefined, {
              sensitivity: "base",
            })
          );
        } else if (typeof data[0] === "string") {
          // sort data
          data.sort();
        }
      }

      listbox.innerHTML = "";
      data.forEach((item) => {
        const option = document.createElement("gux-option");
        option.value = item.id || item;
        option.dataset.name = item.name || item;
        option.dataset.id = item.id || item;
        option.innerHTML = item.name || item;
        listbox.appendChild(option);
      });
      resolve();
    } catch (error) {
      console.error("[OFG] Error populating dropdown: ", error);
      reject(error);
    }
  });
}

// Function to handle page transitions
export async function switchPages(hidePageId, showPageId) {
  const hidePage = document.getElementById(hidePageId);
  const showPage = document.getElementById(showPageId);

  if (hidePage) {
    hidePage.classList.add("inactive-page");
    hidePage.classList.remove("active-page");
  }

  if (showPage) {
    showPage.classList.remove("inactive-page");
    showPage.classList.add("active-page");
  }
}

// Function to validate planning group dropdown entries
export async function validatePlanningGroupDropdown() {
  const planningGroupsDropdown = document.getElementById(
    "planning-group-dropdown"
  );

  // Get list of planning groups in listbox
  const planningGroups = planningGroupsListbox.querySelectorAll("gux-option");

  // Convert planningGroups to an array and iterate over it
  Array.from(planningGroups).forEach((option) => {
    const optionId = option.value;

    // Find the planning group in sharedState.generatedForecast
    const completedFcPg = sharedState.generatedForecast.find(
      (pgForecast) => pgForecast.planningGroup.id === optionId
    );
    const pgName = completedFcPg.planningGroup.name;

    if (completedFcPg.metadata.forecastStatus.isForecast === false) {
      const reason = completedFcPg.metadata.forecastStatus.reason;
      console.warn(
        `[OFG] [${pgName}] Disabling Planning Group with reason: `,
        reason
      );

      // Set the option to disabled
      option.setAttribute("disabled", "true");

      // Update the option text
      let optionText = option.textContent;
      option.textContent = `${optionText} - ${reason}`;
    } else {
      option.removeAttribute("disabled");
    }
  });
  planningGroupsDropdown.removeAttribute("disabled");
}

// Function to delete table rows from a given table	body element
export async function cleanTable(tableBody) {
  // Remove existing table rows
  while (tableBody.firstChild) {
    tableBody.removeChild(tableBody.firstChild);
  }
}

// Function to rotate arrays based on the week start day
export function rotateArrays(array) {
  let weekStart = new Date(
    applicationState.userInputs.forecastParameters.weekStart
  );
  let dayOfWeek = weekStart.getDay();
  let rotateBy = dayOfWeek;

  return [...array.slice(rotateBy), ...array.slice(0, rotateBy)];
}

// Rotate daysOfWeek to BU start day of week array while keeping "All" at the top
export function rotateDaysOfWeek() {
  let startDayString =
    applicationState.userInputs.businessUnit.settings.startDayOfWeek;
  let daysOfWeek = applicationConfig.daysOfWeek;
  // Extract the "All" entry and the rest of the days
  const allEntry = daysOfWeek.find((day) => day.name === "All");
  let restOfDays = daysOfWeek.filter((day) => day.name !== "All");

  // Find the index of the start day in the restOfDays array
  const startDayIndex = restOfDays.findIndex(
    (day) => day.name === startDayString
  );
  if (startDayIndex === -1) {
    console.error(`Start day "${startDayString}" not found in daysOfWeek.`);
    return;
  }

  // Rotate the restOfDays array to start from the startDayIndex
  const rotatedDays = [
    ...restOfDays.slice(startDayIndex),
    ...restOfDays.slice(0, startDayIndex),
  ];

  // Prepend the "All" entry back to the start of the array, if it exists
  if (allEntry) {
    rotatedDays.unshift(allEntry);
  }

  applicationConfig.daysOfWeek = rotatedDays;
}

/*
export function populateErrorMessage(error) {
  const errorContainer = document.getElementById("import-fail-div");

  let message = document.createElement("div");
  message.className = "alert-danger";
  message.innerHTML = error;
  errorContainer.appendChild(message);
}
*/

export function getNextWeekdayDate(startDate, weekday) {
  // Convert the startDate string to a Date object
  const date = new Date(startDate);

  // Days of the week array
  const daysOfWeek = applicationConfig.daysOfWeek;

  // Find the target day object in the daysOfWeek array
  const targetDayObj = daysOfWeek.find((day) => day.name === weekday);

  if (!targetDayObj) {
    throw new Error("Invalid weekday provided.");
  }

  // Convert the id to a number
  const targetDay = parseInt(targetDayObj.id, 10);

  // Get the current day number from the date
  const currentDay = date.getDay();

  // Calculate the difference in days to the target day
  let dayDifference = (targetDay - currentDay + 7) % 7;

  // If the target day is the same as the current day, move to the next week
  if (dayDifference === 0) {
    dayDifference = 7;
  }

  // Add the difference in days to the current date
  date.setDate(date.getDate() + dayDifference);

  // Format the date to "YYYY-MM-DD"
  const nextDate = date.toISOString().split("T")[0];

  //Yq#35Jm$nfmGy6?8

  return nextDate;
}

export async function unhideElement(elementId) {
  const element = document.getElementById(elementId);
  element.style.display = "block";
}

export function displayErrorReason(genereicMessage, specificMessage) {
  const errorDiv = document.getElementById("import-fail-div");
  const errorCard = document.getElementById("import-fail-card");

  // Append a p tag with the message
  let header = document.createElement("h4");
  header.innerHTML = genereicMessage;
  errorCard.appendChild(header);

  let specificP = document.createElement("p");
  specificP.innerHTML = specificMessage;
  errorCard.appendChild(specificP);

  // Display the element
  errorDiv.style.display = "block";
}
