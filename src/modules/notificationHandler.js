// notificationHandler.js
// Description: Module for handling WebSocket notifications

// Shared state modules
import { applicationConfig } from "../core/configManager.js";

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

  onOpen(event) {
    console.log("[OFG] WebSocket connection opened");
    // Add your code here
  }

  subscribeToNotifications() {
    console.info("[OFG] Subscribing to forecast notifications");

    if (testMode) {
      console.log("%c[OFG] Skipping subscription in test mode", "color: red");
      return;
    } else {
      let apiInstance = new window.ofg.PlatformClient.NotificationsApi();

      let body = this.topics.map((topic) => ({
        "id": `v2.workforcemanagement.businessunits.${this.buId}.${topic}`,
      }));

      let opts = {
        "ignoreErrors": false, // Boolean | Optionally prevent throwing of errors for failed permissions checks.
      };

      // Add a list of subscriptions to the existing list of subscriptions
      body.forEach((topicObj) => {
        let topic = topicObj.id.split(".").pop();
        apiInstance
          .postNotificationsChannelSubscriptions(this.id, [topicObj], opts)
          .then((data) => {
            console.debug(
              `[OFG] Subscribed to ${topic} notifications in BU ${this.buId}: `,
              data
            );
            if (this.onSubscribed) {
              this.onSubscribed();
            }
          })
          .catch((err) => {
            console.error(
              `[OFG] Error subscribing to ${topic} notifications in BU ${this.buId}: `,
              err
            );
          });
      });
    }
  }

  handleMessage(event) {
    const notification = JSON.parse(event.data);
    const topicName = notification.topicName;

    if (topicName !== "channel.metadata") {
      console.log(`[OFG] Received notification for topic ${topicName}`);
      this.onMessage(notification);
    }
  }

  onClose(event) {
    console.log("[OFG] WebSocket connection closed");
    // Add any other code here
  }

  onError(event) {
    console.log("[OFG] WebSocket error: ", event);
    // Add any other code here
  }
}
