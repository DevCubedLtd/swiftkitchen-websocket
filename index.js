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

      if (parsedMessage?.type === "REGISTER_CONTROLLER") {
        if (!thisClient) {
          /// this device is a companion device.
          clientInfo.push({
            clientId: ws.clientId,
            deviceId: parsedMessage.deviceId,
            deviceType: deviceTypes.CONTROLLER,
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
                  type: "LINK_SUCCESS",
                  deviceId: ws.clientId,
                })
              );
              // will this only send to this client?
              ws.send(
                JSON.stringify({
                  type: "LINK_SUCCESS",
                  deviceId: parsedMessage.linkedDeviceId,
                })
              );
            }
          });
        }
      }

      if (parsedMessage?.type === "REQUEST_LINK") {
        console.log("request link");

        // we need to add this as a client with device type of
        // this following code should NEVER happen
        if (!thisClient) {
          /// this device is a companion device.
          clientInfo.push({
            clientId: ws.clientId,
            deviceId: parsedMessage.deviceId,
            deviceType: deviceTypes.CONTROLLER,
            ws,
          });
        }

        let thisLinkedClientId = parsedMessage.linkedClientId.trim();

        // is this device even real
        let linkedClient = clientInfo.find(
          (client) => client.clientId === thisLinkedClientId
        );

        console.log("linked client", linkedClient);

        if (!linkedClient) {
          // send error message back to client
          sendMessageToClient(ws.clientId, {
            type: "LINKING_ERROR",
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
            type: "LINK_SUCCESS",
            deviceId: ws.clientId,
          })
        );
        // will this only send to this client?
        ws.send(
          JSON.stringify({
            type: "LINK_SUCCESS",
            deviceId: parsedMessage.linkedDeviceId,
          })
        );
      }

      if (parsedMessage?.type === "REQUEST_LINKING_CODE") {
        if (!thisClient) {
          /// this device is a companion device.
          clientInfo.push({
            clientId: ws.clientId,
            deviceId: parsedMessage.deviceId,
            deviceType: deviceTypes.COMPANION,
            linkedClientId: null,
            ws,
          });
        }

        ws.send(
          JSON.stringify({
            type: "LINKING_CODE",
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
              type: "LINK_SUCCESS",
              deviceId: ws.clientId,
            })
          );
          ws.send(
            JSON.stringify({
              type: "LINK_SUCCESS",
              deviceId: parsedMessage.linkedDeviceId,
            })
          );
        }
      }

      if (parsedMessage?.type === "FOOD_DATA") {
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

      if (parsedMessage?.type === "REQUEST_FOOD_DATA") {
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
            type: "REQUEST_FOOD_DATA",
          })
        );
        console.log("food data requested");

        // we need to send this to the linked client
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
  console.log("Listening to port 8080");
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
