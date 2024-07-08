// genesysApi.js
"use strict";

import platformClient from "platformClient";

let url = new URL(document.location.href);
let gc_region = url.searchParams.get("gc_region");
let gc_clientId = url.searchParams.get("gc_clientId");
let gc_redirectUrl = url.searchParams.get("gc_redirectUrl");

//Getting and setting the GC details from dynamic URL and session storage
gc_region
  ? sessionStorage.setItem("gc_region", gc_region)
  : (gc_region = sessionStorage.getItem("gc_region"));
gc_clientId
  ? sessionStorage.setItem("gc_clientId", gc_clientId)
  : (gc_clientId = sessionStorage.getItem("gc_clientId"));
gc_redirectUrl
  ? sessionStorage.setItem("gc_redirectUrl", gc_redirectUrl)
  : (gc_redirectUrl = sessionStorage.getItem("gc_redirectUrl"));

const client = platformClient.ApiClient.instance;
const uapi = new platformClient.UsersApi();

export async function start() {
  try {
    client.setEnvironment(gc_region);
    client.setPersistSettings(true, "_mm_");

    console.log("%c{am} Logging in to Genesys Cloud", "color: green");
    await client.loginImplicitGrant(gc_clientId, gc_redirectUrl, {});

    //GET Current UserId
    let user = await uapi.getUsersMe({});
    console.log(user);

    //Enter in starting code.
  } catch (err) {
    console.log("{am} Error: ", err);
  }
}

export { uapi };