# Project Name

## Description

This project is an outbound forecast generator for Genesys Cloud that helps businesses predict their future outbound call volumes. It utilizes historical data and algorithms to provide accurate forecasts.

## Features

- Historical data analysis
- Forecast generation based on successful contact rate
- Customizable parameters
- User-friendly interface

## Set up

1. OAuth Client
   1.1. Go to the OAuth client creation page in your Genesys Cloud account.
   1.2. Click on "Create New Client".
   1.3. Fill in the required fields such as Client Name, Description, and Redirect URI.
   1.4. Select the 'Token Implicit Grant (Browser)' Grant Type.
   1.4.1. Set scope to: - analytics:readonly - notifications - outbound:readonly - user-basic-info - workforce-management
   1.5. Save the client and note down the Client ID.

2. Install a Client Apps integration to Genesys Cloud
   2.1. Navigate to the Integrations page in your Genesys Cloud account.
   2.2. Click on "Add Integration".
   2.3. Search for the Client Apps integration and select it.
   2.4. Follow the on-screen instructions to configure the integration.
   2.4.1. On Details page, provide a name and any notes as desired.
   2.4.2. On Configuration > Properties page, define: - Enter https://apmaries.github.io/outbound-forecast-generator/index.html?gc_region=<region-name>&gc_clientId=<OAuth-client-id>&gc_redirectUrl=https://apmaries.github.io/outbound-forecast-generator/index.html as Application URL - widget as Application Type - add 'allow-popups' to Iframe Sandbox Options - Assign an appropirate group to Group Filtering as needed.
   2.4.3. On Configuration > Advanced page, add below JSON for icon rendering
   {
   "icon": {
   "vector": "https://apmaries.github.io/outbound-forecast-generator/img/ofg-logo.svg"
   }
   }
   2.5. Save the integration and ensure it is enabled.

## Usage

1. Open the Genesys Cloud in your preferred web browser.
2. Open the application from the Apps section in the sidebar
3. Adjust the forecast parameters as needed.
4. Adjust forecast inputs as needed.
5. Click on the "Generate" button.
6. View and modify the generated forecast as needed.
7. Click on the "Import" button.

## Assumptions

1. Queues are used to link Outbound Campaigns to WFM Planning Groups - application supports 1:1 mapping of queue to campaign only.
