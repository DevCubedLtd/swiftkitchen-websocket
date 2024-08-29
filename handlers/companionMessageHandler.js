const {
  sendLinkingCode,
  sendRequestFoodData,
  sendCompanionChildSelected,
  sendCompanionChangedDepartment,
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
    };
  }

  if (message.type === messageTypes.REQUEST_LINKING_CODE) {
    if (companionDevices[message.deviceId].linkingCode) {
      sendLinkingCode(ws, companionDevices[message.deviceId].linkingCode);
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
