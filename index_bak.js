const express = require("express");
const https = require("https");
const WebSocket = require("ws");
const crypto = require("crypto");
const db = require("./database/database");
const { readFileSync } = require("fs");
const { parse } = require("path");

const domain = process.env.DOMAIN || "localhost";

const isLocalDevelopment = !process.env.DOMAIN;
console.log("Server msg   : " + "isLocalDevelopment", isLocalDevelopment);

let server;
let io;

if (!isLocalDevelopment) {
  server = https.createServer({
    cert: readFileSync("/etc/letsencrypt/live/" + domain + "/fullchain.pem"),
    key: readFileSync("/etc/letsencrypt/live/" + domain + "/privkey.pem"),
  });
  io = new WebSocket.Server({ server });
} else {
  io = new WebSocket.Server({ port: 443 });
}

const clientInfo = [];
let lastFoodData = [];
var tokenArray = [];

const companionDevices = [];
const checklistDevices = [];

const deviceTypes = {
  COMPANION: "COMPANION",
  CONTROLLER: "CONTROLLER",
};

const messageTypes = {
  REGISTER_CONTROLLER: "REGISTER_CONTROLLER",
  REQUEST_LINK: "REQUEST_LINK",
  REQUEST_LINKING_CODE: "REQUEST_LINKING_CODE",
  LINKING_CODE: "LINKING_CODE",
  LINK_SUCCESS: "LINK_SUCCESS",
  UNLINK_SUCCESS: "UNLINK_SUCCESS",
  REQUEST_UNLINK: "REQUEST_UNLINK",
  LINKING_ERROR: "LINKING_ERROR",
  FOOD_DATA: "FOOD_DATA",
  REQUEST_FOOD_DATA: "REQUEST_FOOD_DATA",
  CHILD_SELECTED: "CHILD_SELECTED",
  LINK_DISCONNECTED: "LINK_DISCONNECTED",
  LINK_CONNECTED: "LINK_CONNECTED",
  COMPANION_CHANGED_DEPARTMENT: "COMPANION_CHANGED_DEPARTMENT",
  SELECT_DEPARTMENT: "SELECT_DEPARTMENT",
  SELECT_MENU: "SELECT_MENU",
  PING: "PING",
  PONG: "PONG",
};

// we should try and load the data here

io.on("connection", function connection(ws) {
  if (!ws.clientId) {
    // when someone connects theyre assigned an id
    // this is because we dont know their device id
    ws.clientId = generateUniqueId();
  }

  ws.on("message", function incoming(message, isBinary) {
    handleIncoming(ws, message, isBinary);
  });

  ws.on("close", function close() {
    handleClose(ws);
  });
});

function handleIncoming(ws, message, isBinary) {
  // every message should be a parsable object but its worth checking to avoid crashed
  if (!tryParseJSONObject(message.toString())) {
    console.log(
      "Server msg   :" + "Incoming message not parsable: ",
      message.toString()
    );
    return;
  }

  let parsedMessage = JSON.parse(message.toString());

  if (!parsedMessage.isCompanion && !parsedMessage.isChecklist) {
    console.log(
      "Server msg   :" +
        "Device connected not identifying as companion or checklist. Likely using an old version of the app"
    );
    return;
  }

  let knownClient;

  // try and find them in existing arrays
  if (parsedMessage.isCompanion) {
    knownClient = companionDevices.find(
      (client) =>
        client.deviceId === parsedMessage.deviceId &&
        client.accessToken === parsedMessage.accessToken
    );
    if (knownClient) {
      ws.clientId = knownClient.clientId;
      knownClient.ws = ws;
      knownClient.currentlyConnected = true;
    }
  }

  // try and find them in existing arrays
  if (parsedMessage.isChecklist) {
    knownClient = checklistDevices.find(
      (client) =>
        client.deviceId === parsedMessage.deviceId &&
        client.accessToken === parsedMessage.accessToken
    );
    if (knownClient) {
      ws.clientId = knownClient.clientId;
      knownClient.ws = ws;
      knownClient.currentlyConnected = true;
    }
  }

  validateToken(parsedMessage).then((isValid) => {
    // ping pong.
    if (parsedMessage?.type === messageTypes.PING) {
      ws.send(
        JSON.stringify({
          type: messageTypes.PONG,
        })
      );
      return;
    }
    if (parsedMessage?.type === messageTypes.PONG) {
      knownClient.pongFailures = 0;
      return;
    }

    // if this is a controller we need to register it,
    // it might already exist (found above) if so
    // we skip that part and just look to see if we need to auto-link it
    if (parsedMessage?.type === messageTypes.REGISTER_CONTROLLER) {
      if (parsedMessage.isCompanion) {
        console.log(
          "Server msg   :" +
            "Something went wrong, companion device tried to register as controller"
        );
        return;
      }

      // checklist app is trying to register itself
      if (!knownClient) {
        // if we dont know the controller, lets add it to the checklist devices
        knownClient = {
          clientId: ws.clientId,
          deviceId: parsedMessage.deviceId,
          deviceType: deviceTypes.CONTROLLER,
          connectedToLink: false,
          currentlyConnected: true,
          pongFailures: 0,
          accessToken: parsedMessage.accessToken,
          isChecklist: true,
          ws,
        };
        checklistDevices.push(knownClient);
      }
      // if we know about this device - lets try and re-link it
      if (knownClient) {
        companionDevices.forEach((companionDevice) => {
          if (companionDevice.linkedClientId === knownClient.ws.clientId) {
            // we found the linked client
            // we need to send the message to them

            // found a client we are linked to
            if (companionDevice.currentlyConnected) {
              companionDevice.ws.send(
                JSON.stringify({
                  type: messageTypes.LINK_SUCCESS,
                  // TODO - wtf have i done here.
                  // clientid vs device id?
                  deviceId: knownClient.deviceId,
                })
              );
              companionDevice.ws.send(
                JSON.stringify({
                  type: messageTypes.LINK_CONNECTED,
                })
              );
              knownClient.ws.send(
                JSON.stringify({
                  type: messageTypes.LINK_SUCCESS,
                  deviceId: parsedMessage.linkedDeviceId,
                })
              );
              knownClient.ws.send(
                JSON.stringify({
                  type: messageTypes.LINK_CONNECTED,
                })
              );
              knownClient.connectedToLink = true;
              companionDevice.connectedToLink = true;
            }
            // =================
          }
        });
      }
      return;
    }

    // this is how we register companions, we return them a linking code
    // if they arnt already registered
    if (parsedMessage?.type === messageTypes.REQUEST_LINKING_CODE) {
      if (parsedMessage.isChecklist) {
        console.log(
          "Server msg   :" +
            "Something went wrong, checklist device tried to request linking code"
        );
        return;
      }
      if (!knownClient) {
        /// this device is a companion device.
        knownClient = {
          clientId: ws.clientId,
          deviceId: parsedMessage.deviceId,
          deviceType: deviceTypes.COMPANION,
          linkedClientId: null,
          connectedToLink: false,
          currentlyConnected: true,
          accessToken: parsedMessage?.accessToken || "",
          isCompanion: true,
          pongFailures: 0,
          ws,
        };
        companionDevices.push(knownClient);
      }

      knownClient.ws.send(
        JSON.stringify({
          type: messageTypes.LINKING_CODE,
          code: ws.clientId,
        })
      );

      // if this was already linked to someone lets get them both connected!
      if (knownClient?.linkedClientId) {
        // we need to send a message to both devices saying linked.
        // and who linked too
        let linkedChecklist = checklistDevices.find(
          (checklistDevice) =>
            checklistDevice.clientId === knownClient.linkedClientId
        );
        linkedChecklist.ws.send(
          JSON.stringify({
            type: messageTypes.LINK_SUCCESS,
            deviceId: ws.clientId,
          })
        );
        knownClient.ws.send(
          JSON.stringify({
            type: messageTypes.LINK_SUCCESS,
            deviceId: parsedMessage.linkedDeviceId,
          })
        );
      }
      return;
    }

    // if a client isnt known by this point then its making requests without registering or
    // something
    if (!knownClient) {
      console.log(
        "Server msg   :" +
          "Client not known by this point, likely making requests without registering or being linked",
        parsedMessage.type
      );
      return;
    }

    if (parsedMessage.isChecklist) {
      handleControllerMessages(ws, parsedMessage, knownClient, isValid);
    }
    if (parsedMessage.isCompanion) {
      handleCompanionMessages(ws, parsedMessage, knownClient, isValid);
    }
  });
}

function handleControllerMessages(ws, parsedMessage, knownClient, isValid) {
  // CONTROLLER
  // sent by the controller to link to a companion device
  if (parsedMessage?.type === messageTypes.REQUEST_LINK) {
    // this linking is authenticated so randoms cant link.
    if (!isValid) {
      knownClient.ws.send(
        JSON.stringify({
          type: messageTypes.LINKING_ERROR,
          message: "Invalid access token",
        })
      );
      return;
    }

    // is can we find the linked client
    let requestedIdToLink = parsedMessage.linkedClientId.trim();

    // find if there is a client to link too
    let linkedClients = companionDevices.filter(
      (companionDevice) =>
        companionDevice.clientId === knownClient.requestedIdToLink
    );

    // if there was no client we have to send linking error
    if (!linkedClients.length) {
      // send error message back to client
      console.log("Server msg   :" + " Cannot find device to link too");

      knownClient.ws.send(
        JSON.stringify({
          type: messageTypes.LINKING_ERROR,
          message:
            "No device found with that id, please ensure you got the code correct and both devices are connected to the internet",
        })
      );
      return;
    }

    // i think this is the answer.
    linkedClients.forEach((linkedClient) => {
      // linkedClient will be an object so we mutate the reference
      linkedClient.linkedClientId = ws.clientId;
      linkedClient.accessToken = parsedMessage?.accessToken;

      // we need to send a message to both devices saying linked.
      // and who linked too

      linkedClient.ws.send(
        JSON.stringify({
          type: messageTypes.LINK_SUCCESS,
          deviceId: ws.clientId,
          accessToken: parsedMessage.accessToken,
        })
      );
      linkedClient.ws.send(
        JSON.stringify({
          type: messageTypes.LINK_CONNECTED,
        })
      );

      linkedClient.connectedToLink = true;

      if (linkedClient.currentlyConnected) {
        knownClient.ws.send(
          JSON.stringify({
            type: messageTypes.LINK_CONNECTED,
          })
        );
      }
    });

    // tell the client the link was successful
    knownClient.ws.send(
      JSON.stringify({
        type: messageTypes.LINK_SUCCESS,
        deviceId: parsedMessage.linkedDeviceId,
      })
    );
    // and if the companion is online tell it.

    knownClient.connectedToLink = true;
    return;
  }

  // CONTROLLER
  // this is the food data that is then sent to companion so it can populate itself
  // should be passed to companion
  // when a child signoff status is updated the food data is sent back to the
  // companion so it can update itself accordingly
  if (parsedMessage?.type === messageTypes.FOOD_DATA) {
    // we need to send this to the linked client
    // we need to find the linked client
    companionDevices.forEach((companionDevice) => {
      if (companionDevice.linkedClientId === knownClient.ws.clientId) {
        //console.log("found a client to send too");
        companionDevice.ws.send(
          JSON.stringify({
            type: "FOOD_DATA",
            data: parsedMessage.data,
          })
        );
      }
    });

    lastFoodData = parsedMessage.data;
    return;
  }

  // CONTROLLER
  if (parsedMessage?.type === messageTypes.REQUEST_UNLINK) {
    knownClient.connectedToLink = false;

    // could be controller
    // need to find companion, unlink in the client info and if connected tell it
    companionDevices.forEach((companionClient) => {
      if (companionClient?.linkedClientId === knownClient.ws.clientId) {
        // we found the linked client
        // we need to send the message to them
        companionClient.linkedClientId = null;
        companionClient.connectedToLink = false;

        // found a client we are linked to!
        if (companionClient.currentlyConnected) {
          companionClient.ws.send(
            JSON.stringify({
              type: messageTypes.UNLINK_SUCCESS,
            })
          );
        }
      }
    });

    knownClient.ws.send(
      JSON.stringify({
        type: messageTypes.UNLINK_SUCCESS,
      })
    );
    return;
  }

  // CONTROLLER
  // this is a checkist telling to companion to change its currently selected department
  if (parsedMessage?.type === messageTypes.SELECT_DEPARTMENT) {
    // we need to send this to the linked client
    // we need to find the linked client
    companionDevices.forEach((companionDevice) => {
      if (companionDevice.linkedClientId === knownClient.ws.clientId) {
        // we found the linked client
        // we need to send the message to them
        //console.log("found a client to send too");
        companionDevice.ws.send(
          JSON.stringify({
            type: "SELECT_DEPARTMENT",
            data: parsedMessage?.data,
          })
        );
      }
    });
    return;
  }

  // CONTROLLER
  if (parsedMessage?.type === messageTypes.SELECT_MENU) {
    // we need to send this to the linked client
    // we need to find the linked client
    companionDevices.forEach((companionDevice) => {
      if (companionDevice.linkedClientId === knownClient.ws.clientId) {
        // we found the linked client
        // we need to send the message to them
        companionDevice.ws.send(
          JSON.stringify({
            type: "SELECT_MENU",
            data: parsedMessage?.data,
          })
        );
      }
    });
    return;
  }
}

function handleCompanionMessages(ws, parsedMessage, knownClient, isValid) {
  // COMPANION
  if (parsedMessage?.type === messageTypes.COMPANION_CHANGED_DEPARTMENT) {
    // we need to send this to the linked client
    // we need to find the linked client
    checklistDevices.forEach((checklistDevice) => {
      if (knownClient.linkedClientId === checklistDevice.clientId) {
        // we found the linked client
        // we need to send the message to them
        //console.log("found a client to selected child too");
        checklistDevice.ws.send(
          JSON.stringify({
            type: messageTypes.COMPANION_CHANGED_DEPARTMENT,
            data: parsedMessage.data,
          })
        );
      }
    });
    return;
  }

  // COMPANION
  // when a child is selected on the companion that child is sent back to
  // onsite so they know which and can sign it off.
  if (parsedMessage?.type === messageTypes.CHILD_SELECTED) {
    // we need to send this to the linked client
    // we need to find the linked client
    checklistDevices.forEach((checklistClient) => {
      if (knownClient.linkedClientId === checklistClient.clientId) {
        // we found the linked client
        // we need to send the message to them
        //console.log("found a client to selected child too");
        checklistClient.ws.send(
          JSON.stringify({
            type: messageTypes.CHILD_SELECTED,
            data: parsedMessage.data,
          })
        );
      }
    });
    return;
  }

  // COMPANION
  // if the companion has no food data it requests it so it can populate
  // itself to allow child selection
  if (parsedMessage?.type === messageTypes.REQUEST_FOOD_DATA) {
    let linkedClient = checklistDevices.find(
      (checklistDevices) =>
        checklistDevices.clientId === knownClient.linkedClientId
    );
    if (!linkedClient) {
      console.log(
        "Server msg   :" + "Requesting food but couldnt find a linked client"
      );
      return;
    }

    linkedClient.ws.send(
      JSON.stringify({
        type: messageTypes.REQUEST_FOOD_DATA,
      })
    );
    return;
  }
}

function handleClose(ws) {
  //console.log("disconnected", ws);
  // find client in clientinfo

  companionDevices.forEach((companion) => {
    if (companion.ws === ws) {
      //console.log("found companion to disconnect", companion.clientId);
      companion.currentlyConnected = false;
      companion.connectedToLink = false;
      if (companion?.linkedClientId) {
        let linkedClient = checklistDevices.find(
          (checklistClient) =>
            checklistClient.clientId === companion.linkedClientId
        );
        if (linkedClient) {
          linkedClient.connectedToLink = false;
          linkedClient.ws.send(
            JSON.stringify({
              type: messageTypes.LINK_DISCONNECTED,
            })
          );
        }
      }
    }
  });

  checklistDevices.forEach((checklist) => {
    if (checklist.ws === ws) {
      //console.log("found checklist to disconnect", checklist.clientId);
      checklist.currentlyConnected = false;
      checklist.connectedToLink = false;
      let linkedClient = companionDevices.find(
        (companionDevice) =>
          companionDevice.linkedClientId === checklist.clientId
      );
      if (linkedClient) {
        linkedClient.connectedToLink = false;
        linkedClient.ws.send(
          JSON.stringify({
            type: messageTypes.LINK_DISCONNECTED,
          })
        );
      }
    }
  });
}

if (!isLocalDevelopment) {
  server.listen(443, () => {
    console.log("Listening to port 443");
  });
}

function tryParseJSONObject(jsonString) {
  try {
    var o = JSON.parse(jsonString);

    // Handle non-exception-throwing cases:
    // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
    // but... JSON.parse(null) returns null, and typeof null === "object",
    // so we must check for that, too. Thankfully, null is falsey, so this suffices:
    if (o && typeof o === "object") {
      return o;
    }
  } catch (e) {}

  return false;
}

function generateUniqueId() {
  // Generate a unique identifier for a client
  // This is a simple example; you might want a more robust method
  // TODO - check it doesnt exist before sending
  return Math.random().toString(36).substr(2, 6).toLocaleUpperCase();
}

function stripWS(linkedClients) {
  let prestripper = JSON.parse(JSON.stringify(linkedClients));
  let stripped = prestripper.map((client) => {
    delete client.ws;
    return client;
  });
  return stripped;
}

async function validateToken(parsedMessage) {
  const accessToken = parsedMessage?.accessToken;
  if (!accessToken) return false;

  const [tokenId, token] = accessToken.split("|");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  // Has token been validated before? Check local array
  if (tokenArray.includes(tokenHash)) return true;

  try {
    const results = await db.query(
      "SELECT id FROM personal_access_tokens WHERE id = ? AND token = ?",
      [tokenId, tokenHash]
    );

    if (results.length > 0) {
      // Valid hash, store in tokenArray
      tokenArray.push(tokenHash);
      return true;
    }
  } catch (error) {
    console.error("Database query failed:", error);
  }
  return false;
}
