const express = require("express");
const https = require("https");
const WebSocket = require("ws");
const crypto = require("crypto");

const db = require("./database/database");

const { readFileSync } = require("fs");
const { parse } = require("path");

const deviceTypes = require("./constants/deviceTypes");
const messageTypes = require("./constants/messageTypes");
const generateUniqueId = require("./utils/generateUniqueId");

const { messageHandler } = require("./handlers/messageHandler");

const domain = process.env.DOMAIN || "localhost";
const isLocalDevelopment = !process.env.DOMAIN;

let server;
let io;

const clientInfo = [];
let lastFoodData = [];
var tokenArray = [];

const companionDevices = {};
const checklistDevices = {};

if (!isLocalDevelopment) {
  server = https.createServer({
    cert: readFileSync("/etc/letsencrypt/live/" + domain + "/fullchain.pem"),
    key: readFileSync("/etc/letsencrypt/live/" + domain + "/privkey.pem"),
  });
  io = new WebSocket.Server({ server });
} else {
  io = new WebSocket.Server({ port: 443 });
}

io.on("connection", function connection(ws) {
  ws.on("message", function incoming(message, isBinary) {
    messageHandler(ws, message, isBinary, companionDevices, checklistDevices);
  });

  ws.on("close", function close() {
    handleClose(ws);
  });
});

if (!isLocalDevelopment) {
  server.listen(443, () => {
    console.log("Listening to port 443");
  });
}

function handleClose(ws) {
  //console.log("disconnected", ws);
  // find client in clientinfo
  // companionDevices.forEach((companion) => {
  //   if (companion.ws === ws) {
  //     //console.log("found companion to disconnect", companion.clientId);
  //     companion.currentlyConnected = false;
  //     companion.connectedToLink = false;
  //     if (companion?.linkedClientId) {
  //       let linkedClient = checklistDevices.find(
  //         (checklistClient) =>
  //           checklistClient.clientId === companion.linkedClientId
  //       );
  //       if (linkedClient) {
  //         linkedClient.connectedToLink = false;
  //         linkedClient.ws.send(
  //           JSON.stringify({
  //             type: messageTypes.LINK_DISCONNECTED,
  //           })
  //         );
  //       }
  //     }
  //   }
  // });
  // checklistDevices.forEach((checklist) => {
  //   if (checklist.ws === ws) {
  //     //console.log("found checklist to disconnect", checklist.clientId);
  //     checklist.currentlyConnected = false;
  //     checklist.connectedToLink = false;
  //     let linkedClient = companionDevices.find(
  //       (companionDevice) =>
  //         companionDevice.linkedClientId === checklist.clientId
  //     );
  //     if (linkedClient) {
  //       linkedClient.connectedToLink = false;
  //       linkedClient.ws.send(
  //         JSON.stringify({
  //           type: messageTypes.LINK_DISCONNECTED,
  //         })
  //       );
  //     }
  //   }
  // });
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
