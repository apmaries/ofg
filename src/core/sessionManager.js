// sessionManager.js
// Description: Module for handling session-related logic

// Shared state modules
import { applicationConfig } from "./configManager.js";

// API instances
import { napi, uapi } from "../app.js";

// Global variables
("use strict");
const testMode = applicationConfig.testMode;

// Function to get user details
async function getUser() {
  try {
    let user = await uapi.getUsersMe({});
    return user;
  } catch (error) {
    console.error("[OFG] Error getting user details. ", error);
    throw error;
  }
}

// Function to open notification channel
async function openNotificationsChannel() {
  let channel = null;
  try {
    channel = await napi.postNotificationsChannels();
    return channel;
  } catch (error) {
    console.error("[OFG] Error opening notifications channel. ", error);
    throw error;
  }
}

// Primary function to start the session
export async function startSession() {
  console.log("[OFG] Starting session");
  let appUser = null;

  if (testMode) {
    appUser = "Test User";
  } else {
    const [user, channel] = await Promise.all([
      getUser(),
      openNotificationsChannel(),
    ]);

    // Set the user and notification channel details
    appUser = user.name;
    applicationConfig.notifications.uri = channel.connectUri;
    applicationConfig.notifications.id = channel.id;
  }

  // Update the UI to welcome the user
  document.getElementById("user-welcome").innerText =
    "Welcome, " + appUser + "!";
}
