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
    messageHandler(
      ws,
      message,
      isBinary,
      companionDevices,
      checklistDevices,
      tokenArray,
      isLocalDevelopment
    );
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
  const disconnectedCompanion = findDisconnectedDevice(companionDevices, ws);
  const disconnectedChecklist = findDisconnectedDevice(checklistDevices, ws);

  if (disconnectedCompanion) {
    handleDeviceDisconnection(
      disconnectedCompanion,
      checklistDevices,
      companionDevices,
      ws
    );
  } else if (disconnectedChecklist) {
    handleDeviceDisconnection(
      disconnectedChecklist,
      companionDevices,
      checklistDevices,
      ws
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
  ws
) {
  let keys = Object.keys(thisDeviceObj);
  let index = Object.values(thisDeviceObj).findIndex(
    (device) => device.ws === ws
  );
  let deviceId = keys[index]?.substr(0, 8);
  console.log("Server msg   : " + deviceId + " has disconnected");

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
