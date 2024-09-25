# Outbound Forecast Generator for Genesys Cloud WFM

## Description

This project is an outbound forecast generator for Genesys Cloud that helps businesses predict their future outbound call volumes. It utilizes historical data and algorithms to provide accurate forecasts.

## Features

- Historical data analysis
- Forecast generation based on successful contact rate
- Customizable parameters
- User-friendly interface

## Set up

1. OAuth Client
   1. Go to the OAuth client creation page in your Genesys Cloud account.
   2. Click on "Create New Client".
   3. Fill in the required fields such as Client Name, Description, and Redirect URI.
   4. Select the 'Token Implicit Grant (Browser)' Grant Type.
   5. Set scope to:
      - analytics:readonly
      - notifications
      - outbound:readonly
      - user-basic-info
      - workforce-management
   6. Save the client and note down the Client ID.
2. Install a Client Apps integration to Genesys Cloud.
   1. Navigate to the Integrations page in your Genesys Cloud account.
   2. Click on "Add Integration".
   3. Search for the Client Apps integration and select it.
   4. Follow the on-screen instructions to configure the integration.
   5. On Details page, provide a name and any notes as desired.
   6. On Configuration > Properties page:
      - Enter `https://apmaries.github.io/outbound-forecast-generator/index.html?gc_region=<region-name>&gc_clientId=<OAuth-client-id>&gc_redirectUrl=https://apmaries.github.io/outbound-forecast-generator/index.html` as Application URL.
      - Enter `widget` as Application Type.
      - Add `allow-popups` to Iframe Sandbox Options.
      - Assign an appropriate group to Group Filtering as needed.
   7. On Configuration > Advanced page, add below JSON for icon rendering
      ```
      {
      	"icon": {
      	"vector": "https://apmaries.github.io/outbound-forecast-generator/img/ofg-logo.svg"
      		}
      }
      ```
   8. Save the integration and ensure it is enabled.

## Known Issues

1. Daylight savings offsets need to be fixed - currently imports as 768 intervals (8 days x 96 intervals). On DLS changes, this needs to be updated to 764 and 772 respectively
   - Time zone is known & stored in applicationState.userInputs.businessUnit.settings.timeZone
   - If this time zone has DLS offsets, need to know when those are
   - If forecast week is an offset week (e.g. first Sunday in October)
     1. Add 4 intervals
     1. Remove 4 intervals
