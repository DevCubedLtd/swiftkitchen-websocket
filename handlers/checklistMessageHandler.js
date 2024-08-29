const { validateToken } = require("../database/validateToken");

function checklistMessageHandler(
  ws,
  message,
  checklistDevices,
  companionDevices
) {
  console.log("Checklist message received: ", message);

  // before we do anything, validate the token
  validateToken(message).then((isValid) => {
    if (!isValid) {
      sendInvalidToken(ws);
      console.log("Message attempted with invalid access token");
      return;
    }

    if (!checklistDevicesDevices[message.deviceId]) {
      companionDevices[message.deviceId] = {
        ws,
        linkedTo: null,
      };
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
        console.log("No companion found with that linking code");
        return;
      }

      // link devices
      checklistDevices[message.deviceId].linkedTo = foundCompanionDeviceId;
      companionDevices[foundCompanionDeviceId].linkedTo = message.deviceId;

      // so i need to tell everyone that theyre linked?
      sendLinkConnected(ws);
      sendLinkConnected(companionDevices[foundCompanionDeviceId].ws);
    }

    if (message?.type === messageTypes.REQUEST_UNLINK) {
      //TODO
    }

    if (message?.type === messageTypes.SELECT_DEPARTMENT) {
      //TODO
    }

    if (message?.type === messageTypes.SELECT_MENU) {
      //TODO
    }

    if (message?.type === messageTypes.FOOD_DATA) {
      //TODO
    }
  });
}

module.exports = { checklistMessageHandler };
