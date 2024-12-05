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
const { sendLinkDisconnected } = require("./broadcast/broadcast");

const domain = process.env.DOMAIN || "localhost";
const isLocalDevelopment = !process.env.DOMAIN;

console.log("isLocalDevelopment 3", isLocalDevelopment);

let server;
let io;

const clientInfo = [];
let lastFoodData = [];
var tokenArray = [];

const companionDevices = {};
const checklistDevices = {};

const locationIds = {};

if (!isLocalDevelopment) {
  server = https.createServer({
    cert: readFileSync("/etc/letsencrypt/live/" + domain + "/fullchain.pem"),
    key: readFileSync("/etc/letsencrypt/live/" + domain + "/privkey.pem"),
  });
  io = new WebSocket.Server({ server });
} else {
  console.log("Started insecure websocket server port: 443");
  io = new WebSocket.Server({ port: 443 });
}

io.on("connection", function connection(ws) {
  ws.on("message", function incoming(message, isBinary) {
    messageHandler(
      ws,
      message,
      isBinary,
      companionDevices,
      checklistDevices,
      tokenArray,
      isLocalDevelopment,
      locationIds
    );
  });

  ws.on("close", function close(event) {
    handleClose(ws, event);
  });
});

if (!isLocalDevelopment) {
  server.listen(443, () => {
    console.log("Listening to port 443");
  });
}

function handleClose(ws, event) {
  const disconnectedCompanion = findDisconnectedDevice(companionDevices, ws);
  const disconnectedChecklist = findDisconnectedDevice(checklistDevices, ws);

  if (disconnectedCompanion) {
    handleDeviceDisconnection(
      disconnectedCompanion,
      checklistDevices,
      companionDevices,
      ws,
      event
    );
  } else if (disconnectedChecklist) {
    handleDeviceDisconnection(
      disconnectedChecklist,
      companionDevices,
      checklistDevices,
      ws,
      event
    );
  }
}

function findDisconnectedDevice(devices, ws) {
  return Object.values(devices).find((device) => device.ws === ws);
}

function handleDeviceDisconnection(
  disconnectedDevice,
  linkedDevices,
  thisDeviceObj,
  ws,
  event
) {
  let keys = Object.keys(thisDeviceObj);
  let index = Object.values(thisDeviceObj).findIndex(
    (device) => device.ws === ws
  );
  let deviceId = keys[index]?.substr(0, 8);
  console.log(
    "Server msg   : " +
      deviceId +
      "locationId: " +
      locationIds[deviceId] +
      " " +
      " has disconnected. reason: " +
      getCloseReason(event)
  );

  const { linkedTo } = disconnectedDevice;

  sendDisconnectionMessage(disconnectedDevice.ws);

  if (linkedTo && linkedDevices[linkedTo]) {
    const linkedDevice = linkedDevices[linkedTo];
    sendDisconnectionMessage(linkedDevice.ws);
    linkedDevice.linkedTo = null;
  }

  disconnectedDevice.linkedTo = null;
  disconnectedDevice.ws = null;
}

function sendDisconnectionMessage(ws) {
  if (ws) {
    sendLinkDisconnected(ws);
  }
}

function getCloseReason(code) {
  const reasons = {
    1000: "Normal closure",
    1001: "Going away - Client/server is going down or browser is navigating away",
    1002: "Protocol error",
    1003: "Unsupported data type",
    1004: "Reserved",
    1005: "No status code present",
    1006: "Abnormal closure - Connection dropped without close frame",
    1007: "Invalid frame payload data",
    1008: "Policy violation",
    1009: "Message too big",
    1010: "Required extension missing",
    1011: "Internal server error",
    1012: "Service restart",
    1013: "Try again later",
    1014: "Bad gateway",
    1015: "TLS handshake failure",
  };
  return reasons[code] + " " + code || `Unknown reason (${code})`;
}
