const {
  sendLinkingCode,
  sendRequestFoodData,
  sendCompanionChildSelected,
  sendCompanionChangedDepartment,
  sendLinkConnected,
  sendLinkSuccess,
} = require("../broadcast/broadcast");
const { messageTypes } = require("../constants/messageTypes");
const generateUniqueId = require("../utils/generateUniqueId");
const { stripWSFromJSON } = require("../utils/stripWSFromJSON");

function companionMessageHandler(
  ws,
  message,
  checklistDevices,
  companionDevices
) {
  if (!companionDevices[message.deviceId]) {
    companionDevices[message.deviceId] = {
      ws,
      linkedTo: null,
      linkingCode: null,
      lastKnownLinkedTo: null,
    };
  } else {
    companionDevices[message.deviceId].ws = ws;
  }

  let debugLinkedTo = "";
  if (companionDevices[message?.deviceId]?.linkedTo) {
    debugLinkedTo = companionDevices[message?.deviceId]?.linkedTo;
  }

  console.log(
    "Companion msg:",
    message?.deviceId?.substring(0, 8),
    message?.type,
    " Possible Link:" + (debugLinkedTo?.substring(0, 8) || " None"),
    " ip?:",
    ws._socket.remoteAddress
  );

  if (message.type === messageTypes.REQUEST_LINKING_CODE) {
    // Generate or retrieve existing linking code
    let generatedLinkingCode =
      companionDevices[message.deviceId].linkingCode ||
      generateUniqueId(companionDevices);
    companionDevices[message.deviceId].linkingCode = generatedLinkingCode;
    sendLinkingCode(ws, generatedLinkingCode);

    // Attempt relink using lastKnownLinkedTo
    let lastKnownLinkedTo =
      companionDevices[message.deviceId].lastKnownLinkedTo;

    if (lastKnownLinkedTo && checklistDevices[lastKnownLinkedTo]) {
      let checklistDevice = checklistDevices[lastKnownLinkedTo];

      // Verify both devices remember each other
      if (checklistDevice.lastKnownLinkedTo === message.deviceId) {
        // Reestablish bidirectional link
        checklistDevice.linkedTo = message.deviceId;
        companionDevices[message.deviceId].linkedTo = lastKnownLinkedTo;

        // Notify both devices of successful relink
        sendLinkConnected(ws);
        sendLinkConnected(checklistDevice.ws);
        sendLinkSuccess(ws, lastKnownLinkedTo, message.accessToken);

        // Request initial data sync
        sendRequestFoodData(checklistDevice.ws);
      }
    }
    return;
  }

  if (message?.type === messageTypes.COMPANION_CHANGED_DEPARTMENT) {
    if (!companionDevices[message.deviceId].linkedTo) {
      console.log("Server msg   :" + "Companion is not linked to a client");
      return;
    }

    let linkedClient =
      checklistDevices[companionDevices[message.deviceId].linkedTo];
    if (!linkedClient || !linkedClient.ws) {
      console.log("Server msg   :" + "Linked client not found");
      return;
    }

    sendCompanionChangedDepartment(linkedClient.ws, message.data);
    return;
  }

  if (message?.type === messageTypes.CHILD_SELECTED) {
    if (!companionDevices[message.deviceId].linkedTo) {
      console.log("Server msg   :" + "Companion is not linked to a client");
      return;
    }

    let linkedClient =
      checklistDevices[companionDevices[message.deviceId].linkedTo];
    if (!linkedClient || !linkedClient.ws) {
      // console.log({
      //   companions: stripWSFromJSON(companionDevices),
      //   checklist: stripWSFromJSON(checklistDevices),
      // });
      console.log("Server msg   :" + "Linked client not found");
      return;
    }

    sendCompanionChildSelected(linkedClient.ws, message.data);
    return;
  }

  if (message?.type === messageTypes.REQUEST_FOOD_DATA) {
    if (!companionDevices[message.deviceId].linkedTo) {
      console.log("Server msg   :" + "Companion is not linked to a client");
      return;
    }

    let linkedClient =
      checklistDevices[companionDevices[message.deviceId].linkedTo];
    if (!linkedClient || !linkedClient.ws) {
      console.log("Server msg   :" + "Linked client not found");
      return;
    }

    sendRequestFoodData(linkedClient.ws);
    return;
  }
}

module.exports = { companionMessageHandler };
