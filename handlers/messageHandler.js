const { tryParseJSONObject } = require("../utils/tryParseJSONObject");
const { companionMessageHandler } = require("./companionMessageHandler");
const { checklistMessageHandler } = require("./checklistMessageHandler");

let ipHash = {};

function messageHandler(
  ws,
  message,
  isBinary,
  companionDevices,
  checklistDevices,
  tokenArray,
  isLocalDevelopment,
  locationIds
) {
  let parsedMessage = checkMessageSafety(message);
  if (!parsedMessage) return;
  let unparsedMessage = message;

  if (message?.locationId && message?.deviceId) {
    locationIds[message.deviceId] = message.locationId;
  }

  if (parsedMessage?.deviceId) {
    if (!ipHash[parsedMessage.deviceId]) {
      ipHash[parsedMessage.deviceId] = ws._socket.remoteAddress;
    } else if (ipHash[parsedMessage.deviceId] !== ws._socket.remoteAddress) {
      console.log(
        "Device id: ",
        parsedMessage.deviceId,
        " has changed IP address from ",
        ipHash[parsedMessage.deviceId],
        " to ",
        ws._socket.remoteAddress
      );
      ipHash[parsedMessage.deviceId] = ws._socket.remoteAddress;
    }
  }

  if (parsedMessage.isCompanion) {
    companionMessageHandler(
      ws,
      parsedMessage,
      checklistDevices,
      companionDevices
    );
  } else if (parsedMessage.isChecklist) {
    checklistMessageHandler(
      ws,
      parsedMessage,
      unparsedMessage,
      checklistDevices,
      companionDevices,
      tokenArray,
      isLocalDevelopment
    );
  }
}

function checkMessageSafety(message) {
  // every message should be a parsable object but its worth checking to avoid crashed
  if (!tryParseJSONObject(message.toString())) {
    console.log("Incoming message not parsable: ", message.toString());
    return;
  }
  let parsedMessage = JSON.parse(message.toString());
  if (!parsedMessage.isCompanion && !parsedMessage.isChecklist) {
    console.log(
      "Device connected not identifying as companion or checklist. Likely using an old version of the app"
    );
    return;
  }
  return parsedMessage;
}

module.exports = { messageHandler };
