// sessionHandler.js
// Description: Module for handling session-related logic

import { applicationConfig } from "./configManager.js";
import { napi, uapi } from "../app.js";

const testMode = applicationConfig.testMode;
("use strict");

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
  } catch (error) {
    console.error("[OFG] Error opening notifications channel. ", error);
    throw error;
  }

  console.log("[OFG] Notifications channel opened");
  applicationConfig.notifications.uri = channel.connectUri;
  applicationConfig.notifications.id = channel.id;
}

// Primary function to start the session
export async function startSession() {
  console.log("[OFG] Starting session");
  let appUser = null;

  if (testMode) {
    appUser = "Test User";
  } else {
    user = await getUser();
    openNotificationsChannel();
  }
  document.getElementById("user-welcome").innerText =
    "Welcome, " + appUser + "!";
}