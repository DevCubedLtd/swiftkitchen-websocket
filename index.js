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
  LINKING_ERROR: "LINKING_ERROR",
  FOOD_DATA: "FOOD_DATA",
  REQUEST_FOOD_DATA: "REQUEST_FOOD_DATA",
  CHILD_SELECTED: "CHILD_SELECTED",
};

io.on("connection", function connection(ws) {
  if (!ws.clientId) {
    // when someone connects theyre assigned an id
    // this is because we dont know their device id
    ws.clientId = generateUniqueId();
    console.log("connected and assigned (possibly temporary) id ", ws.clientId);
  }

  ws.on("message", function incoming(message, isBinary) {
    console.log("string message ", message.toString(), isBinary);

    // every message should be a parsable object but its worth checking to avoid crashed
    if (tryParseJSONObject(message.toString())) {
      let parsedMessage = JSON.parse(message.toString());
      console.log(`parse message from ${ws.clientId}`, parsedMessage);

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
        console.log(
          "device already registered, reassigning old id: ",
          ws.clientId
        );
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
            isLinkOnline: false,
            ws,
          });
        }
        // we need to try and relink here.

        // iff this client already existed,
        // look to find if it was linked anywhere
        if (thisClient) {
          clientInfo.forEach((client) => {
            if (client.linkedClientId === ws.clientId) {
              // we found the linked client
              // we need to send the message to them

              // found a client we are linked to!
              client.ws.send(
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
          });
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

        if (!linkedClient) {
          // send error message back to client
          sendMessageToClient(ws.clientId, {
            type: messageTypes.LINKING_ERROR,
            message: "Device not found",
          });
          return;
        }

        // this link should be many companions to one hub so
        // thats fine
        // linkedClient will be an object so we mutate the reference
        linkedClient.linkedClientId = ws.clientId;

        // we need to send a message to both devices saying linked.
        // and who linked too
        linkedClient.ws.send(
          JSON.stringify({
            type: messageTypes.LINK_SUCCESS,
            deviceId: ws.clientId,
          })
        );
        // will this only send to this client?
        ws.send(
          JSON.stringify({
            type: messageTypes.LINK_SUCCESS,
            deviceId: parsedMessage.linkedDeviceId,
          })
        );

        // we need to set both clients as linked in our clientInfo
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
            isLinkOnline: false,
            ws,
          });
        }

        ws.send(
          JSON.stringify({
            type: messageTypes.LINKING_CODE,
            code: ws.clientId,
          })
        );

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
    }
  });

  ws.on("close", function close() {
    console.log("disconnected");
  });
});

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

function sendMessageToClient(clientId, message) {
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
