// pageHandler.js
// Description: Module for handling page navigation and populating page content

// API instances
import { oapi, wapi } from "../app.js";
import { t_oapi, t_wapi } from "../core/testManager.js";

// Shared state modules
import { applicationConfig } from "../core/configManager.js";
import { applicationState } from "../core/stateManager.js";

// App modules
import { generateForecast, importForecast } from "./forecastHandler.js";
import {
  getSelectedPgForecastData,
  populateGraphAndTable,
} from "./modificationHandler.js";

// Utility modules
import {
  populateDropdown,
  hideLoadingSpinner,
  resetLoadingSpinner,
  cleanTable,
  rotateDaysOfWeek,
  updateLoadingMessage,
  switchPages,
  getNextWeekdayDate,
} from "../utils/domUtils.js";
import { addEvent, removeEventListeners } from "../utils/eventUtils.js";
import {
  getForecastParameters,
  getOptions,
  getPlanningGroupContacts,
} from "../utils/inputUtils.js";

// Global variables
("use strict");
const testMode = applicationConfig.testMode;

// Function to load page one
export async function loadPageOne() {
  console.info("[OFG.UI] Loading page one");

  // Clean applicationState.userInputs
  cleanUserInputs();

  const businessUnitListbox = document.getElementById("business-unit-listbox");

  // Get list of business units
  async function getBusinessUnits() {
    try {
      const businessUnits = testMode
        ? await t_wapi.getBusinessUnits()
        : await wapi.getWorkforcemanagementBusinessunits();
      console.info(
        `[OFG.UI] Loaded ${businessUnits.entities.length} business units`
      );

      return businessUnits.entities; // Return the list of business units
    } catch (error) {
      console.error("[OFG.UI] Error getting business units!", error);
      throw error;
    }
  }

  // Get selected business unit settings
  async function getBusinessUnitSettings(businessUnitId) {
    console.info(
      `[OFG.UI] Getting settings for business unit ${businessUnitId}`
    );
    let opts = {
      "expand": ["settings.timeZone", "settings.startDayOfWeek"], // Include to access additional data on the business unit
    };
    try {
      const businessUnit = testMode
        ? await t_wapi.getBusinessUnitData()
        : await wapi.getWorkforcemanagementBusinessunit(businessUnitId, opts);
      console.info(
        `[OFG.UI] Loaded settings for ${businessUnit.name} (${businessUnit.id})`
      );

      applicationState.userInputs.businessUnit.name = businessUnit.name;
      applicationState.userInputs.businessUnit.id = businessUnit.id;
      applicationState.userInputs.businessUnit.settings = businessUnit.settings;

      // Populate the business unit settings to UI
      populateBusinessUnitSettings(businessUnit);

      console.debug(
        "[OFG.UI] Application state after business unit selection",
        applicationState
      );
    } catch (error) {
      console.error("[OFG.UI] Error getting business unit settings!", error);
      throw error;
    }
  }

  function populateBusinessUnitSettings(businessUnit) {
    console.info("[OFG.UI] Populating business unit settings");
    const businessUnitSettings = businessUnit.settings;

    const timeZone = businessUnitSettings.timeZone;
    document.getElementById("bu-timezone").value = timeZone;

    const startDayOfWeek = businessUnitSettings.startDayOfWeek;

    document.getElementById(
      "week-start-label"
    ).textContent = `Week start (${startDayOfWeek})`;

    const datepicker = document.getElementById("week-start");
    datepicker.value = getNextWeekdayDate(datepicker.value, startDayOfWeek);
  }

  // Main logic for loading page one
  try {
    const businessUnits = await getBusinessUnits();
    await populateDropdown(businessUnitListbox, businessUnits, "name", true);
  } catch (error) {
    console.error(
      "[OFG.UI] Error populating dropdown with business units",
      error
    );
    return; // Exit function if there's an error loading business units
  }

  // Add event listener for business unit selection
  addEvent(businessUnitListbox, "change", (event) => {
    const selectedValue = event.target.value;
    getBusinessUnitSettings(selectedValue);
  });

  // Add event listener for next button
  addEvent(document.getElementById("p1-next-button"), "click", async () => {
    // Validate user has selected a Business Unit
    if (!applicationState.userInputs.businessUnit.id) {
      alert("Please select a Business Unit");
      return;
    }

    // Validate user has selected correct start day of week
    const selectedDate = document.getElementById("week-start").value;
    const selectedDayIndex = new Date(selectedDate).getDay();

    const buWeekStart =
      applicationState.userInputs.businessUnit.settings.startDayOfWeek;
    const daysOfWeek = applicationConfig.daysOfWeek;
    const buWeekStartIndex = daysOfWeek.find(
      (day) => day.name === buWeekStart
    ).id;

    if (selectedDayIndex !== Number(buWeekStartIndex)) {
      alert(`Please select a ${buWeekStart} as the start day of the week`);

      // Add a red asterisk to start of label
      const label = document.getElementById("week-start-label");
      const span = document.createElement("span");
      span.textContent = " * ";
      span.style.color = "red";
      label.append(span);

      document.getElementById("week-start").click();

      return;
    }

    console.info("[OFG.UI] Switching to page two");
    switchPages("page-one", "page-two");
    await loadPageTwo();

    removeEventListeners(businessUnitListbox, "change");
    removeEventListeners(document.getElementById("p1-next-button"), "click");
  });

  // Hide loading spinner and show main
  await hideLoadingSpinner("main", "main-loading-section");
  console.info("[OFG.UI] Page one loaded");
}

// Function to load page two
async function loadPageTwo() {
  console.info("[OFG.UI] Loading page two");

  // Clean applicationState.userInputs
  cleanUserInputs();

  // Clean forecast outputs
  applicationState.forecastOutputs.generatedForecast = null;
  applicationState.forecastOutputs.modifiedForecast = null;

  const planningGroupsTableBody = document.querySelector(
    "#planning-groups-table tbody"
  );

  // Function to create a table cell
  function createCell(textContent, dataId, dataValue) {
    const cell = document.createElement("td");
    cell.textContent = textContent;
    if (dataId) {
      cell.dataset[dataId] = dataValue;
    }
    return cell;
  }

  // Function to create a number input
  function createNumberInput(groupId, groupName, matchingCampaign) {
    const guxFormFieldNumber = document.createElement("gux-form-field-number");
    guxFormFieldNumber.setAttribute("label-position", "screenreader");

    const input = document.createElement("input");
    input.slot = "input";
    input.type = "number";
    input.id = "nContacts_" + groupId;
    input.min = "0";
    input.max = "100000";
    input.value = "0";
    input.step = "500";

    const label = document.createElement("label");
    label.slot = "label";
    label.textContent = groupName + " number of contacts";

    if (!matchingCampaign) {
      input.disabled = true;
    }

    guxFormFieldNumber.appendChild(input);
    guxFormFieldNumber.appendChild(label);

    return guxFormFieldNumber;
  }

  // Function to append rows to the table body
  function appendRowsToTable(groups, isMatched) {
    groups.forEach((group) => {
      console.debug(
        `[OFG.UI] Appending ${
          isMatched ? "matched" : "unmatched"
        } rows to table`,
        group
      );
      const row = document.createElement("tr");

      // Planning Group column: Display planningGroup.name and optionally campaign.name
      const planningGroupCell = createCell(
        group.planningGroup.name,
        "pgId",
        group.planningGroup.id
      );
      if (isMatched) {
        const campaignNameSpan = document.createElement("span");
        campaignNameSpan.textContent = ` [${group.campaign.name}]`;
        campaignNameSpan.className = "italic-gray";
        planningGroupCell.appendChild(document.createElement("br"));
        planningGroupCell.appendChild(campaignNameSpan);
      } else {
        planningGroupCell.classList.add("grey-italic");
      }
      row.appendChild(planningGroupCell);

      // # Contacts column: Use createNumberInput function, disable if not matched
      const contactsCell = document.createElement("td");
      const numberInput = createNumberInput(
        group.groupId,
        group.groupName,
        isMatched
      );
      contactsCell.appendChild(numberInput);
      row.appendChild(contactsCell);

      // Append the row to the table body
      planningGroupsTableBody.appendChild(row);
    });
  }

  // Get list of planning groups
  async function getPlanningGroups() {
    try {
      const planningGroups = testMode
        ? await t_wapi.getPlanningGroups()
        : await wapi.getWorkforcemanagementBusinessunitPlanninggroups(
            applicationState.userInputs.businessUnit.id
          );
      console.info(
        `[OFG.UI] Loaded ${planningGroups.entities.length} planning groups`
      );

      return planningGroups.entities; // Return the list of planning groups
    } catch (error) {
      console.error("[OFG.UI] Error getting planning groups!", error);
      throw error;
    }
  }

  // Get list of campaigns
  async function getCampaigns() {
    try {
      const campaigns = testMode
        ? await t_oapi.getOutboundCampaigns()
        : await oapi.getOutboundCampaigns();
      console.info(`[OFG.UI] Loaded ${campaigns.entities.length} campaigns`);
      return campaigns.entities; // Return the list of campaigns
    } catch (error) {
      console.error("[OFG.UI] Error getting campaigns!", error);
      throw error;
    }
  }

  // Function to match campaigns to planning groups by associated queue id
  async function queueCampaignMatcher(planningGroups, campaigns) {
    console.info("[OFG.UI] Matching campaigns to planning groups");

    // Array to hold groups
    const matchedGroups = [];
    const unmatchedGroups = [];

    // Loop through planning groups and campaigns to match them
    planningGroups.forEach((pg) => {
      const pgName = pg.name;
      const pgQueueId = pg.routePaths[0].queue.id;

      // Object to hold group info
      let group = {
        planningGroup: {
          name: pgName,
          id: pg.id,
        },
        campaign: {
          name: "",
          id: "",
        },
        queue: {
          name: "",
          id: "",
        },
      };

      const matchedCampaign = campaigns.find((c) => c.queue.id === pgQueueId);

      if (matchedCampaign) {
        pg.campaign = matchedCampaign;
        console.info(
          `[OFG.UI] [${pgName}] Matched campaign ${matchedCampaign.name} (${matchedCampaign.id})`
        );
        group.campaign.name = matchedCampaign.name;
        group.campaign.id = matchedCampaign.id;
        group.queue.name = matchedCampaign.queue.name;
        group.queue.id = matchedCampaign.queue.id;
        matchedGroups.push(group);
      } else {
        console.warn(`[OFG.UI] [${pgName}] No matching campaign found`);
        unmatchedGroups.push(group);
      }

      // Add group to application state
      applicationState.userInputs.planningGroups.push(group);
    });

    // Enable inboundMode if any planning group are not matched
    if (unmatchedGroups.length > 0) {
      applicationConfig.inbound.inboundMode = true;
      document.getElementById("inbound-forecast-div").style.display = "block";
      document.getElementById("generate-inbound-fc").checked = true;
      console.info("[OFG.UI] Inbound mode enabled");
    }

    return [matchedGroups, unmatchedGroups];
  }

  // Main logic for loading page two
  try {
    const [planningGroups, campaigns] = await Promise.all([
      getPlanningGroups(),
      getCampaigns(),
    ]);
    const [matchedGroups, unmatchedGroups] = await queueCampaignMatcher(
      planningGroups,
      campaigns
    );

    // Append matched and unmatched groups to the table
    appendRowsToTable(matchedGroups, true);
    if (unmatchedGroups.length > 0) {
      appendRowsToTable(unmatchedGroups, false);
    }
  } catch (error) {
    console.error("[OFG.UI] Error loading page two", error);
    return; // Exit function if there's an error loading planning groups or campaigns
  }

  // Add event listener to generate button
  addEvent(document.getElementById("generate-button"), "click", async () => {
    const totalContacts = await getPlanningGroupContacts();

    if (!totalContacts) {
      return;
    }

    // Assign applicationState.userInputs variables
    Object.assign(
      applicationState.userInputs.forecastParameters,
      getForecastParameters()
    );
    Object.assign(applicationState.userInputs.forecastOptions, getOptions());

    // Rotate the days of week based on the start day of week
    rotateDaysOfWeek();

    // Generate the forecast & load page three
    switchPages("page-two", "page-three");
    try {
      await generateForecast();
      await loadPageThree();
    } catch (error) {
      console.error("[OFG.UI] Forecast generation failed");
      switchPages("page-three", "page-four");
      await loadPageFour();
    }
    resetPageTwo();

    // Remove event listeners
    removeEventListeners(document.getElementById("generate-button"), "click");
    removeEventListeners(document.getElementById("p2-back-button"), "click");
  });

  // Add event listener for back button
  addEvent(document.getElementById("p2-back-button"), "click", async () => {
    switchPages("page-two", "page-one");
    await loadPageOne();
    resetPageTwo();

    // Remove event listeners
    removeEventListeners(document.getElementById("generate-button"), "click");
    removeEventListeners(document.getElementById("p2-back-button"), "click");
  });

  // Hide loading spinner and show planning groups table
  await hideLoadingSpinner(
    "planning-groups-container",
    "planning-groups-loading"
  );
  console.info("[OFG.UI] Page two loaded");
}

// Function to load page three
async function loadPageThree() {
  console.info("[OFG.UI] Loading page three");

  // Initialize the forecast outputs
  const generatedForecast = applicationState.forecastOutputs.generatedForecast;
  applicationState.forecastOutputs.modifiedForecast = JSON.parse(
    JSON.stringify(generatedForecast)
  );

  // Get the planning groups from sharedState
  const planningGroupsSummary = generatedForecast
    .filter((pg) => pg.metadata.forecastStatus.isForecast === true)
    .map((pg) => ({
      id: pg.planningGroup.id,
      name: pg.planningGroup.name,
    }));

  // Populate page three listboxes
  populateDropdown(
    document.getElementById("planning-group-listbox"),
    planningGroupsSummary,
    "name",
    true
  );
  populateDropdown(
    document.getElementById("week-day-listbox"),
    applicationConfig.daysOfWeek,
    "name",
    false
  );

  // Add event listener for Planning Group dropdown
  const planningGroupDropdown = document.getElementById(
    "planning-group-dropdown"
  );
  planningGroupDropdown.removeAttribute("disabled");
  addEvent(planningGroupDropdown, "change", async () => {
    await new Promise((resolve) => setTimeout(resolve, 50)); // Delay to ensure selection is updated
    let selectedPgFc = await getSelectedPgForecastData();

    if (selectedPgFc) {
      await populateGraphAndTable(selectedPgFc);
    }
  });

  // Add event listener for weekday dropdown
  const weekDayDropdown = document.getElementById("week-day-dropdown");
  weekDayDropdown.removeAttribute("disabled");
  addEvent(weekDayDropdown, "change", async () => {
    let selectedPgFc = await getSelectedPgForecastData();

    if (selectedPgFc) {
      await populateGraphAndTable(selectedPgFc);
    }
  });

  // Add event listener for import button
  addEvent(document.getElementById("import-button"), "click", async () => {
    switchPages("page-three", "page-four");
    await loadPageFour();
    resetPageThree();

    try {
      await importForecast();

      // Hide loading spinner and show page four
      hideLoadingSpinner(
        "import-results-container",
        "results-loading-message"
      );

      // Add event listener for open forecast button
      addEvent(document.getElementById("open-forecast-button"), "click", () => {
        // Can't seem to make this work easily - button is disabled
        // temp logging
        console.log(
          "[OFG.TEMP] Open forecast button clicked",
          applicationConfig.outbound.fcUrl
        );

        try {
          const newWindow = window.open(
            applicationConfig.outbound.fcUrl,
            "_blank"
          );
          if (!newWindow) {
            throw new Error(
              "Failed to open new window. It might be blocked by a pop-up blocker."
            );
          }
        } catch (error) {
          console.error("[OFG] An error occurred:", error);
          errorManager.logError({
            Source:
              "https://apmaries.github.io/sandpit-testing/src/modules/pageHandler.js",
            Line: 527,
            Column: 0,
            URL: "https://apmaries.github.io/sandpit-testing/index.html",
            ErrorObject: error,
          });
        }
      });
    } catch (error) {
      console.error("[OFG.UI] Forecast import failed");
    }

    removeEventListeners(planningGroupDropdown, "change");
    removeEventListeners(weekDayDropdown, "change");
  });

  // Add event listener for back button
  addEvent(document.getElementById("p3-back-button"), "click", async () => {
    switchPages("page-three", "page-two");
    await loadPageTwo();
    resetPageThree();

    removeEventListeners(planningGroupDropdown, "change");
    removeEventListeners(weekDayDropdown, "change");
  });

  // Hide loading spinner and show page three
  await hideLoadingSpinner(
    "forecast-outputs-container",
    "generate-loading-div"
  );
  console.info("[OFG.UI] Page three loaded");
}

// Function to load page four
async function loadPageFour() {
  console.info("[OFG.UI] Loading page four");

  // Add event listener for reset button
  addEvent(document.getElementById("restart-button"), "click", async () => {
    console.debug("[OFG.UI] Restart button clicked");
    switchPages("page-four", "page-one");
    await loadPageOne();
    resetPageFour();

    removeEventListeners(document.getElementById("import-button"), "click");
    removeEventListeners(
      document.getElementById("open-forecast-button"),
      "click"
    );
  });

  console.info("[OFG.UI] Page four loaded");
}

function resetPageTwo() {
  // Clean planning groups table
  cleanTable(document.querySelector("#planning-groups-table tbody"));

  // Reset the loading spinner and hide inbound forecast div
  resetLoadingSpinner("planning-groups-container", "planning-groups-loading");
  document.getElementById("inbound-forecast-div").style.display = "none";
}

function resetPageThree() {
  updateLoadingMessage("generate-loading-message", "Generating forecast");
  resetLoadingSpinner("forecast-outputs-container", "generate-loading-div");
}

function resetPageFour() {
  // Reset all elements to display: none in the import results container
  const elementsToReset = document.querySelectorAll(
    "#import-results-container, #import-results-container *"
  );
  elementsToReset.forEach((element) => {
    element.style.display = "none";
  });

  // Reset the loading spinner and message
  updateLoadingMessage(
    "results-loading-message",
    "Subscribing to forecast import notifications..."
  );
  resetLoadingSpinner(
    "import-results-container",
    "results-loading-message"
  );

  // Reset open button to disabled
  document.getElementById("open-forecast-button").disabled = true;
}

function cleanUserInputs() {
  applicationState.userInputs.planningGroups = [];
  applicationConfig.inbound.inboundMode = false;
}
