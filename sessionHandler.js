// sessionHandler.js

export async function startSession() {
  console.log("{am} Starting session");

  try {
    // GET Current UserId
    //const uapi = new window.platformClientModule.UsersApi();
    let user = await window.am.usersApi.getUsersMe({});
    console.log("{am} User details returned", user);
    document.getElementById("content").innerText =
      "Welcome, " + user.name + "!";
  } catch (error) {
    console.error("{am} Error getting user details. ", error);
    throw error;
  }
}
