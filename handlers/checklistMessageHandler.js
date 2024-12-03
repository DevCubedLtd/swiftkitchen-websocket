const { validateToken } = require("../database/validateToken");
const {
  sendInvalidToken,
  sendLinkConnected,
  sendLinkSuccess,
  sendUnlinkSuccess,
  sendSelectMenu,
  sendFoodData,
  sendLinkingError,
  sendChecklistDepartmentSelected,
  sendCloseDrawer,
  relayMessage,
} = require("../broadcast/broadcast");
const { messageTypes } = require("../constants/messageTypes");

function checklistMessageHandler(
  ws,
  message,
  unparsedMessage,
  checklistDevices,
  companionDevices,
  tokenArray,
  isLocalDevelopment
) {
  let debugLinkedTo = "";
  if (checklistDevices[message?.deviceId]?.linkedTo) {
    debugLinkedTo = checklistDevices[message?.deviceId]?.linkedTo;
  }

  console.log(
    "Checklist msg:",
    message?.deviceId?.substring(0, 8),
    message?.type,
    " Possible Link:" + (debugLinkedTo?.substring(0, 8) || "None"),
    "ip?:",
    ws._socket.remoteAddress
  );

  // before we do anything, validate the token
  validateToken(message, tokenArray).then((isValid) => {
    if (!isValid && !isLocalDevelopment) {
      sendInvalidToken(ws);
      console.log("Message attempted with invalid access token");
      return;
    }
    if (!isValid && isLocalDevelopment) {
      console.log("query failed but its ok");
    }

    if (!checklistDevices[message.deviceId]) {
      checklistDevices[message.deviceId] = {
        ws,
        linkedTo: null,
        lastKnownLinkedTo: null,
      };
    } else {
      checklistDevices[message.deviceId].ws = ws;
    }

    if (message?.type === messageTypes.REGISTER_CONTROLLER) {
      let lastKnownLinkedTo =
        checklistDevices[message.deviceId].lastKnownLinkedTo;

      if (lastKnownLinkedTo && companionDevices[lastKnownLinkedTo]) {
        let companionDevice = companionDevices[lastKnownLinkedTo];

        // Verify both devices remember each other
        if (companionDevice.lastKnownLinkedTo === message.deviceId) {
          // Reestablish bidirectional link
          checklistDevices[message.deviceId].linkedTo = lastKnownLinkedTo;
          companionDevice.linkedTo = message.deviceId;

          // Notify both devices
          sendLinkConnected(ws);
          sendLinkConnected(companionDevice.ws);
          sendLinkSuccess(
            companionDevice.ws,
            message.deviceId,
            message.accessToken
          );

          // Initial data sync
          sendRequestFoodData(ws);
        }
      }
    }

    if (message?.type === messageTypes.REQUEST_LINK) {
      if (!message?.linkedClientId) {
        sendLinkingError(ws, "No linked client id provided");
        console.log("No linked client id provided");
        return;
      }

      let companionIds = Object.keys(companionDevices);
      let found = false;
      let foundCompanionDeviceId = null;
      companionIds.forEach((id) => {
        if (companionDevices[id].linkingCode === message.linkedClientId) {
          found = true;
          foundCompanionDeviceId = id;
        }
      });

      if (!found) {
        sendLinkingError(ws, "No companion found with that linking code");
        console.log(
          "No companion found with linking code:" + message?.linkedClientId
        );
        return;
      }

      // link devices
      checklistDevices[message.deviceId].linkedTo = foundCompanionDeviceId;
      companionDevices[foundCompanionDeviceId].linkedTo = message.deviceId;

      checklistDevices[message.deviceId].lastKnownLinkedTo =
        foundCompanionDeviceId;
      companionDevices[foundCompanionDeviceId].lastKnownLinkedTo =
        message.deviceId;

      // so i need to tell everyone that theyre linked?
      sendLinkConnected(ws);
      sendLinkConnected(companionDevices[foundCompanionDeviceId].ws);
      sendLinkSuccess(
        companionDevices[foundCompanionDeviceId].ws,
        message.deviceId,
        message.accessToken
      );
    }

    if (message?.type === messageTypes.REQUEST_UNLINK) {
      let checklistDevice = checklistDevices[message.deviceId];
      let companionDevice =
        companionDevices[checklistDevices[message.deviceId].linkedTo];

      if (!checklistDevice || !companionDevice) {
        console.log("No companion found to unlink from");
        return;
      }

      // unlink devices
      checklistDevice.linkedTo = null;
      companionDevice.linkedTo = null;

      sendUnlinkSuccess(ws);
      sendUnlinkSuccess(companionDevice.ws);
    }

    if (message?.type === messageTypes.SELECT_DEPARTMENT) {
      let companionDevice =
        companionDevices[checklistDevices[message.deviceId].linkedTo];

      if (!companionDevice) {
        console.log("No companion found to select department");
        return;
      }

      sendChecklistDepartmentSelected(companionDevice.ws, message.data);
    }

    if (message?.type === messageTypes.SELECT_MENU) {
      let companionDevice =
        companionDevices[checklistDevices[message.deviceId].linkedTo];

      if (!companionDevice) {
        console.log("No companion found to select menu");
        return;
      }

      sendSelectMenu(companionDevice.ws, message.data);
    }

    if (message?.type === messageTypes.CLOSE_DRAWER) {
      let companionDevice =
        companionDevices[checklistDevices[message.deviceId].linkedTo];

      if (!companionDevice) {
        console.log("No companion found to close drawer");
        return;
      }

      sendCloseDrawer(companionDevice.ws, message.data);
    }

    if (message?.type === messageTypes.FOOD_DATA) {
      let companionDevice =
        companionDevices[checklistDevices[message.deviceId].linkedTo];

      if (!companionDevice) {
        console.log("No companion found to send food data");
        return;
      }

      // TODO IMMEDIATELY
      if (companionDevice?.ws) {
        //sendFoodData(companionDevice.ws, message.data);
        relayMessage(companionDevice.ws, unparsedMessage);
      } else {
        console.log(
          "Tried to send to companion but companion didnt have a ws connection."
        );
      }
    }
  });
}

module.exports = { checklistMessageHandler };
