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
    " Possible Link:" + debugLinkedTo?.substring(0, 8)
  );

  if (message.type === messageTypes.REQUEST_LINKING_CODE) {
    if (companionDevices[message.deviceId].linkingCode) {
      sendLinkingCode(ws, companionDevices[message.deviceId].linkingCode);

      // attempt to relink the devices
      let lastKnownLinkedTo =
        companionDevices[message.deviceId].lastKnownLinkedTo;
      let checklistDevice = checklistDevices[lastKnownLinkedTo];

      if (checklistDevice) {
        if (checklistDevice.linkedTo === null) {
          checklistDevice.linkedTo = message.deviceId;
          companionDevices[message.deviceId].linkedTo = lastKnownLinkedTo;
          sendLinkConnected(ws);
          sendLinkConnected(checklistDevice.ws);
          sendLinkSuccess(ws, message.deviceId, message.accessToken);
        }
      }

      return;
    }
    let generatedLinkingCode = generateUniqueId(companionDevices);
    companionDevices[message.deviceId].linkingCode = generatedLinkingCode;
    sendLinkingCode(ws, generatedLinkingCode);
    return;
  }

  if (message?.type === messageTypes.COMPANION_CHANGED_DEPARTMENT) {
    if (!companionDevices[message.deviceId].linkedTo) {
      console.log("Companion is not linked to a client");
      return;
    }

    let linkedClient =
      checklistDevices[companionDevices[message.deviceId].linkedTo];
    if (!linkedClient || !linkedClient.ws) {
      console.log("Linked client not found");
      return;
    }

    sendCompanionChangedDepartment(linkedClient.ws, message.data);
    return;
  }

  if (message?.type === messageTypes.CHILD_SELECTED) {
    if (!companionDevices[message.deviceId].linkedTo) {
      console.log("Companion is not linked to a client");
      return;
    }

    let linkedClient =
      checklistDevices[companionDevices[message.deviceId].linkedTo];
    if (!linkedClient || !linkedClient.ws) {
      console.log({
        companions: stripWSFromJSON(companionDevices),
        checklist: stripWSFromJSON(checklistDevices),
      });
      console.log("Linked client not found");
      return;
    }

    sendCompanionChildSelected(linkedClient.ws, message.data);
    return;
  }

  if (message?.type === messageTypes.REQUEST_FOOD_DATA) {
    if (!companionDevices[message.deviceId].linkedTo) {
      console.log("Companion is not linked to a client");
      return;
    }

    let linkedClient =
      checklistDevices[companionDevices[message.deviceId].linkedTo];
    if (!linkedClient || !linkedClient.ws) {
      console.log("Linked client not found");
      return;
    }

    sendRequestFoodData(linkedClient.ws);
    return;
  }
}

module.exports = { companionMessageHandler };
