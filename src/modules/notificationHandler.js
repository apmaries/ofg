// notificationHandler.js
// Description: Module for handling WebSocket notifications

// Shared state modules
import { applicationConfig } from "../core/configManager.js";

// API instances
import { napi } from "../app.js";

// Global variables
("use strict");
const testMode = applicationConfig.testMode;

//let notificationsUri = applicationConfig.notifications.uri;
// let notificationsId = applicationConfig.notifications.id;

// Class to handle WebSocket notifications
export class NotificationHandler {
  constructor(topics, buId, onSubscribed, onMessage) {
    this.uri = applicationConfig.notifications.uri;
    this.id = applicationConfig.notifications.id;

    if ((!this.uri || !this.id) && !testMode) {
      alert("An error occurred. Please refresh the page and try again.");
      throw new Error("Notifications channel URI and ID not defined");
    }

    this.topics = topics;
    this.buId = buId;
    this.onSubscribed = onSubscribed;
    this.onMessage = onMessage;
    this.ws = null;
  }

  connect() {
    if (this.uri) {
      this.ws = new WebSocket(this.uri);

      // Connection opened
      this.ws.addEventListener("open", this.onOpen.bind(this));

      // Listen for messages
      this.ws.addEventListener("message", this.handleMessage.bind(this));

      // Connection closed
      this.ws.addEventListener("close", this.onClose.bind(this));

      // Connection error
      this.ws.addEventListener("error", this.onError.bind(this));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.removeEventListener("open", this.onOpen.bind(this));
      this.ws.removeEventListener("message", this.handleMessage.bind(this));
      this.ws.removeEventListener("close", this.onClose.bind(this));
      this.ws.removeEventListener("error", this.onError.bind(this));
      this.ws.close();
      this.ws = null;
      console.log("[OFG.NOTIFICATIONS] WebSocket connection closed manually");
    }
  }

  onOpen(event) {
    console.log("[OFG.NOTIFICATIONS] WebSocket connection opened");
    // Add your code here
  }

  subscribeToNotifications() {
    console.info("[OFG.NOTIFICATIONS] Subscribing to forecast notifications");

    if (testMode) {
      console.log(
        "%c[OFG.NOTIFICATIONS] Skipping subscription in test mode",
        "color: red"
      );
      return;
    } else {
      let body = this.topics.map((topic) => ({
        "id": `v2.workforcemanagement.businessunits.${this.buId}.${topic}`,
      }));

      let opts = {
        "ignoreErrors": false, // Boolean | Optionally prevent throwing of errors for failed permissions checks.
      };

      // Add a list of subscriptions to the existing list of subscriptions
      body.forEach((topicObj) => {
        let topic = topicObj.id.split(".").pop();
        napi
          .postNotificationsChannelSubscriptions(this.id, [topicObj], opts)
          .then((data) => {
            console.debug(
              `[OFG.NOTIFICATIONS] Subscribed to ${topic} notifications in BU ${this.buId}: `,
              data
            );
            if (this.onSubscribed) {
              this.onSubscribed();
            }
          })
          .catch((err) => {
            console.error(
              `[OFG.NOTIFICATIONS] Error subscribing to ${topic} notifications in BU ${this.buId}: `,
              err
            );
          });
      });
    }
  }

  handleMessage(event) {
    const notification = JSON.parse(event.data);
    const topicName = notification.topicName;

    // Split topic name by periods and get the last element
    const topic = topicName.split(".").pop();

    if (topicName !== "channel.metadata") {
      console.log(
        `[OFG.NOTIFICATIONS] Received ${topic} notification`,
        notification
      );
      this.onMessage(notification);
    }
  }

  onClose(event) {
    console.log("[OFG.NOTIFICATIONS] WebSocket connection closed");
    // Add any other code here
  }

  onError(event) {
    console.log("[OFG.NOTIFICATIONS] WebSocket error: ", event);
    // Add any other code here
  }
}
