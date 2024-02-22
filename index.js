const express = require("express");
const { createServer } = require("node:http");
const { join } = require("node:path");
const { Server } = require("socket.io");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const io = new WebSocket.Server({ server });

const clientInfo = [];
let lastFoodData = [];

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
  PING: "PING",
  PONG: "PONG",
};

io.on("connection", function connection(ws) {
  if (!ws.clientId) {
    // when someone connects theyre assigned an id
    // this is because we dont know their device id
    ws.clientId = generateUniqueId();
    console.log("connected and assigned (possibly temporary) id ", ws.clientId);
  }

  ws.on("message", function incoming(message, isBinary) {
    // every message should be a parsable object but its worth checking to avoid crashed
    if (tryParseJSONObject(message.toString())) {
      let parsedMessage = JSON.parse(message.toString());

      // every message we need to check if this device has registered and make sure its
      // assigned its old ids and stuff
      let thisClient = clientInfo.find(
        (client) => client.deviceId === parsedMessage.deviceId
      );
      // we found it in our local array so we give it the old id for consistency
      // the hope is that we can reopen broken connections
      if (thisClient) {
        ws.clientId = clientInfo.find(
          (client) => client.deviceId === parsedMessage.deviceId
        ).clientId;
        thisClient.ws = ws;
        thisClient.currentlyConnected = true;
      }

      if (parsedMessage?.type !== messageTypes.PONG) {
        console.log(`${ws.clientId} sent message: `, parsedMessage);
      }

      // if this is a controller we need to register it,
      // it might already exist (found above) if so
      // we skip that part and just look to see if we need to auto-link it
      if (parsedMessage?.type === messageTypes.REGISTER_CONTROLLER) {
        if (!thisClient) {
          /// this device is a controller.
          clientInfo.push({
            clientId: ws.clientId,
            deviceId: parsedMessage.deviceId,
            deviceType: deviceTypes.CONTROLLER,
            connectedToLink: false,
            currentlyConnected: true,
            pongFailures: 0,
            ws,
          });
        }
        // we need to try and relink here.

        // iff this client already existed,
        // look to find if it was linked anywhere
        if (thisClient) {
          console.log(
            "device already registered, reassigning old id: ",
            ws.clientId
          );
          clientInfo.forEach((client) => {
            if (client.linkedClientId === ws.clientId) {
              // we found the linked client
              // we need to send the message to them

              // found a client we are linked to!
              if (client.currentlyConnected) {
                client.ws.send(
                  JSON.stringify({
                    type: messageTypes.LINK_SUCCESS,
                    deviceId: ws.clientId,
                  })
                );

                client.ws.send(
                  JSON.stringify({
                    type: messageTypes.LINK_CONNECTED,
                  })
                );

                client.isConnectedToLink = true;
              }

              ws.send(
                JSON.stringify({
                  type: messageTypes.LINK_SUCCESS,
                  deviceId: parsedMessage.linkedDeviceId,
                })
              );
              if (client.currentlyConnected) {
                ws.send(
                  JSON.stringify({
                    type: messageTypes.LINK_CONNECTED,
                  })
                );
                thisClient.isConnectedToLink = true;
              }
            }
          });
        }
      }

      // this is how we register companions, we return them a linking code
      // if they arnt already registered
      if (parsedMessage?.type === messageTypes.REQUEST_LINKING_CODE) {
        if (!thisClient) {
          /// this device is a companion device.
          clientInfo.push({
            clientId: ws.clientId,
            deviceId: parsedMessage.deviceId,
            deviceType: deviceTypes.COMPANION,
            linkedClientId: null,
            connectedToLink: false,
            currentlyConnected: true,
            pongFailures: 0,
            ws,
          });
        }

        ws.send(
          JSON.stringify({
            type: messageTypes.LINKING_CODE,
            code: ws.clientId,
          })
        );

        if (thisClient) {
          console.log(
            "device already registered, reassigning old id: ",
            ws.clientId
          );
        }

        // if this was already linked to someone lets get them both connected!
        if (thisClient?.linkedClientId) {
          // we need to send a message to both devices saying linked.
          // and who linked too
          let linkedClient = clientInfo.find(
            (client) => client.clientId === thisClient.linkedClientId
          );
          linkedClient.ws.send(
            JSON.stringify({
              type: messageTypes.LINK_SUCCESS,
              deviceId: ws.clientId,
            })
          );
          ws.send(
            JSON.stringify({
              type: messageTypes.LINK_SUCCESS,
              deviceId: parsedMessage.linkedDeviceId,
            })
          );
        }
      }

      // sent by the controller to link to a companion device
      if (parsedMessage?.type === messageTypes.REQUEST_LINK) {
        // we need to add this as a client with device type of
        // this following code should NEVER happen
        if (!thisClient) {
          console.log("request link from unregistered client?");
        }

        let thisLinkedClientId = parsedMessage.linkedClientId.trim();

        // is this device even real
        let linkedClient = clientInfo.find(
          (client) => client.clientId === thisLinkedClientId
        );

        console.log("linked client", linkedClient);

        if (!linkedClient) {
          // send error message back to client
          ws.send(JSON.stringify({
            type: messageTypes.LINKING_ERROR,
            message: "Device not found",
          }))
          return;
        }

        // this link should be many companions to one hub so
        // thats fine
        // linkedClient will be an object so we mutate the reference
        linkedClient.linkedClientId = ws.clientId;

        // we need to send a message to both devices saying linked.
        // and who linked too

        if (linkedClient.currentlyConnected) {
          linkedClient.ws.send(
            JSON.stringify({
              type: messageTypes.LINK_SUCCESS,
              deviceId: ws.clientId,
            })
          );
          linkedClient.ws.send(
            JSON.stringify({
              type: messageTypes.LINK_CONNECTED,
            })
          );

          linkedClient.isConnectedToLink = true;
        }

        // will this only send to this client?
        ws.send(
          JSON.stringify({
            type: messageTypes.LINK_SUCCESS,
            deviceId: parsedMessage.linkedDeviceId,
          })
        );
        if (linkedClient.currentlyConnected) {
          ws.send(
            JSON.stringify({
              type: messageTypes.LINK_CONNECTED,
            })
          );

          thisClient.isConnectedToLink = true;
        }

        thisClient.isConnectedToLink = true;

        // we need to set both clients as linked in our clientInfo
      }

      // if the companion has no food data it requests it so it can populate
      // itself to allow child selection
      if (parsedMessage?.type === messageTypes.REQUEST_FOOD_DATA) {
        if (!thisClient) {
          console.log("requested food data for unregistered client?");
          return;
        }

        let linkedClient = clientInfo.find(
          (client) => client.clientId === thisClient.linkedClientId
        );
        if (!linkedClient) {
          console.log("linked client not found");
          return;
        }
        console.log("reqesting food data from:", linkedClient.clientId);
        linkedClient.ws.send(
          JSON.stringify({
            type: messageTypes.REQUEST_FOOD_DATA,
          })
        );
        console.log("food data requested");

        // we need to send this to the linked client
      }

      // this is the food data that is then sent to companion so it can populate itself
      // should be passed to companion
      // when a child signoff status is updated the food data is sent back to the
      // companion so it can update itself accordingly
      if (parsedMessage?.type === messageTypes.FOOD_DATA) {
        if (!thisClient) {
          console.log("food data received but no client found");
          return;
        }

        // we need to send this to the linked client
        // we need to find the linked client
        clientInfo.forEach((client) => {
          if (client.linkedClientId === ws.clientId) {
            // we found the linked client
            // we need to send the message to them

            console.log("found a client to send too");
            client.ws.send(
              JSON.stringify({
                type: "FOOD_DATA",
                data: parsedMessage.data,
              })
            );
          }
        });

        lastFoodData = parsedMessage.data;
      }

      // when a child is selected on the companion that child is sent back to
      // onsite so they know which and can sign it off.
      if (parsedMessage?.type === messageTypes.CHILD_SELECTED) {
        if (!thisClient) {
          /// this device is a companion device.
          console.log("selected a child when device isnt registered?");
          return;
        }

        // we need to send this to the linked client
        // we need to find the linked client
        clientInfo.forEach((client) => {
          if (thisClient.linkedClientId === client.clientId) {
            // we found the linked client
            // we need to send the message to them
            console.log("found a client to selected child too");
            client.ws.send(
              JSON.stringify({
                type: messageTypes.CHILD_SELECTED,
                data: parsedMessage.data,
              })
            );
          }
        });
      }

      if (parsedMessage?.type === messageTypes.REQUEST_UNLINK) {
        if (!thisClient) {
          console.log("requested unlink for unregistered client?");
          return;
        }

        thisClient.isConnectedToLink = false;

        if (thisClient?.linkedClientId) {
          // is a companion...
          // need to remove link and tell both its unlinked
          thisClient.linkedClientId = null;

          let linkedClient = clientInfo.find(
            (client) => client.clientId === thisClient?.linkedClientId
          );
          linkedClient.isConnectedToLink = false;

          // tell both clients theyre unlinked
          if (linkedClient.currentlyConnected) {
            linkedClient.ws.send(
              JSON.stringify({
                type: messageTypes.UNLINK_SUCCESS,
              })
            );
          }
        }

        // could be controller
        // need to find companion, unlink in the client info and if connected tell it
        clientInfo.forEach((client) => {
          if (client?.linkedClientId === ws.clientId) {
            // we found the linked client
            // we need to send the message to them
            client.linkedClientId = null;
            client.isConnectedToLink = false;

            // found a client we are linked to!
            if (client.currentlyConnected) {
              client.ws.send(
                JSON.stringify({
                  type: messageTypes.UNLINK_SUCCESS,
                })
              );
            }
          }
        });

        ws.send(
          JSON.stringify({
            type: messageTypes.UNLINK_SUCCESS,
          })
        );
      }

      if (parsedMessage?.type === messageTypes.PING) {
        ws.send(
          JSON.stringify({
            type: messageTypes.PONG,
          })
        );
      }

      if (parsedMessage?.type === messageTypes.PONG) {
        if (!thisClient) {
          console.log("got pong from unregistered client?");
          return;
        }
        thisClient.pongFailures = 0;
      }

      if (parsedMessage?.type === messageTypes.COMPANION_CHANGED_DEPARTMENT) {
        if (!thisClient) {
          /// this device is a companion device.
          console.log("selected a child when device isnt registered?");
          return;
        }

        // we need to send this to the linked client
        // we need to find the linked client
        clientInfo.forEach((client) => {
          if (thisClient.linkedClientId === client.clientId) {
            // we found the linked client
            // we need to send the message to them
            console.log("found a client to selected child too");
            client.ws.send(
              JSON.stringify({
                type: messageTypes.COMPANION_CHANGED_DEPARTMENT,
                data: parsedMessage.data,
              })
            );
          }
        });
      }

      // this is a master telling to companion to change its currently selected department
      if (parsedMessage?.type === messageTypes.SELECT_DEPARTMENT) {
        if (!thisClient) {
          console.log("change department data received but no client found");
          return;
        }

        // we need to send this to the linked client
        // we need to find the linked client
        clientInfo.forEach((client) => {
          if (client.linkedClientId === ws.clientId) {
            // we found the linked client
            // we need to send the message to them

            console.log("found a client to send too");
            client.ws.send(
              JSON.stringify({
                type: "SELECT_DEPARTMENT",
                data: parsedMessage.data,
              })
            );
          }
        });

        lastFoodData = parsedMessage.data;
      }
    }
  });

  ws.on("close", function close() {
    console.log("disconnected", ws);
    // find client in clientinfo

    clientInfo.forEach((client) => {
      if (client.clientId === ws.clientId) {
        console.log("found client to disconnect", client.clientId);
        client.currentlyConnected = false;
        client.isConnectedToLink = false;

        if (client?.linkedClientId) {
          console.log("has linked client");
          // we need to tell linked device that its no longer connected to the client
          let linkedClient = clientInfo.find(
            (thisClient) => thisClient.clientId === client.linkedClientId
          );

          if (linkedClient) {
            console.log(
              "found a linked client to tell to disconnect",
              linkedClient.clientId
            );

            linkedClient.isConnectedToLink = false;
            // TODO: we should also tell the clients theyre no longer connected
            linkedClient.ws.send(
              JSON.stringify({
                type: messageTypes.LINK_DISCONNECTED,
              })
            );
          }
        }
      }

      // if its a controller we need to find the client linked to it and yeet.
      clientInfo.forEach((thisClient) => {
        if (thisClient?.linkedClientId === client.clientId) {
          thisClient.connectedToLink = false;

          console.log(
            "found a device linked to this client and am sending message",
            thisClient.clientId,
            client.clientId
          );

          // TODO: we should also tell the clients theyre no longer connected
          thisClient.ws.send(
            JSON.stringify({
              type: messageTypes.LINK_DISCONNECTED,
            })
          );
        }
      });
    });

    // we need to tell linked device that its no longer connected to the client
  });
});

// set timeout to ping pong with all clients
// this is to keep connections open
setInterval(() => {
  clientInfo.forEach((client) => {
    if (client.currentlyConnected) {
      if (client.pongFailures > 0) {
        console.log(
          `client ${client.clientId} has failed to pong ${client.pongFailures} times`
        );
      }
      client.pongFailures++;
      if (client.pongFailures > 5) {
        client.currentlyConnected = false;
        client.isConnectedToLink = false;

        if (client?.linkedClientId) {
          // we need to tell linked device that its no longer connected to the client
          let linkedClient = clientInfo.find(
            (clientFind) => clientFind.clientId === client.linkedClientId
          );

          if (linkedClient) {
            linkedClient.isConnectedToLink = false;
            // TODO: we should also tell the clients theyre no longer connected
            linkedClient.ws.send(
              JSON.stringify({
                type: messageTypes.LINK_DISCONNECTED,
              })
            );
          }
        }

        // if its a controller we need to find the client linked to it and yeet.
        clientInfo.forEach((otherClient) => {
          if (otherClient?.linkedClientId === client.clientId) {
            otherClient.connectedToLink = false;

            // TODO: we should also tell the clients theyre no longer connected
            otherClient.ws.send(
              JSON.stringify({
                type: messageTypes.LINK_DISCONNECTED,
              })
            );
          }
        });

        client.pongFailures = 0;
        return;
      }

      client.ws.send(
        JSON.stringify({
          type: messageTypes.PING,
        })
      );
    }
  });
}, 10000);

app.get("/", (req, res) => {
  res.send(`
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/default.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/json.min.js"></script>


<pre><code class="language-json"> ${JSON.stringify(
    stripWS(clientInfo),
    null,
    2
  )}<code/></pre>


  <pre><code class="language-json"> ${JSON.stringify(
    stripWS(lastFoodData),
    null,
    2
  )}<code/></pre>

  <script>hljs.highlightAll();</script>
  `);
});

server.listen(8099, () => {
  console.log("Listening to port 8099");
});

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

function ws.send(clientId, message) {
  let client = clientInfo.find((client) => client.clientId === clientId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.ws.send(message);
  }
}

function stripWS(linkedClients) {
  let prestripper = JSON.parse(JSON.stringify(linkedClients));
  let stripped = prestripper.map((client) => {
    delete client.ws;
    return client;
  });
  return stripped;
}
