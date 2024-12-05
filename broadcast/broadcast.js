const { messageTypes } = require("../constants/messageTypes");

function sendLinkingCode(ws, linkingCode) {
  console.log("Server msg   : ^^^^^^^^ Sent linking code: ", linkingCode);
  try {
    ws.send(
      JSON.stringify({ type: messageTypes.LINKING_CODE, code: linkingCode })
    );
  } catch (error) {
    console.error("Error sending linking code:", error);
  }
}

function sendFoodData(ws, foodData) {
  try {
    ws.send(JSON.stringify({ type: messageTypes.FOOD_DATA, data: foodData }));
  } catch (error) {
    console.error("Error sending food data:", error);
  }
}

function relayMessage(ws, originalMessage) {
  try {
    ws.send(originalMessage.toString());
  } catch (error) {
    console.error("Error sending food data:", error);
  }
}

function sendCompanionChangedDepartment(ws, department) {
  try {
    ws.send(
      JSON.stringify({
        type: messageTypes.COMPANION_CHANGED_DEPARTMENT,
        data: department,
      })
    );
  } catch (error) {
    console.error("Error sending companion changed department:", error);
  }
}

function sendCompanionChildSelected(ws, child) {
  try {
    ws.send(JSON.stringify({ type: messageTypes.CHILD_SELECTED, data: child }));
  } catch (error) {
    console.error("Error sending companion child selected:", error);
  }
}

function sendRequestFoodData(ws) {
  try {
    ws.send(JSON.stringify({ type: messageTypes.REQUEST_FOOD_DATA }));
  } catch (error) {
    console.error("Error sending request food data:", error);
  }
}

function sendInvalidToken(ws) {
  try {
    ws.send(
      JSON.stringify({
        type: messageTypes.LINKING_ERROR,
        message: "Invalid access token",
      })
    );
  } catch (error) {
    console.error("Error sending invalid token:", error);
  }
}

function sendLinkingError(ws, message) {
  try {
    ws.send(JSON.stringify({ type: messageTypes.LINKING_ERROR, message }));
  } catch (error) {
    console.error("Error sending linking error:", error);
  }
}

function sendLinkConnected(ws) {
  try {
    ws.send(JSON.stringify({ type: messageTypes.LINK_CONNECTED }));
  } catch (error) {
    console.error("Error sending link connected:", error);
  }
}

function sendLinkSuccess(ws, deviceId, accessToken) {
  try {
    ws.send(
      JSON.stringify({
        type: messageTypes.LINK_SUCCESS,
        deviceId,
        accessToken,
      })
    );
  } catch (error) {
    console.error("Error sending link success:", error);
  }
}

function sendUnlinkSuccess(ws) {
  try {
    ws.send(JSON.stringify({ type: messageTypes.UNLINK_SUCCESS }));
  } catch (error) {
    console.error("Error sending unlink success:", error);
  }
}

function sendCompanionChangedDepartment(ws, changeDeparmentData) {
  try {
    ws.send(
      JSON.stringify({
        type: messageTypes.COMPANION_CHANGED_DEPARTMENT,
        data: changeDeparmentData,
      })
    );
  } catch (error) {
    console.error("Error sending companion changed department:", error);
  }
}

function sendSelectMenu(ws, menuData) {
  try {
    ws.send(JSON.stringify({ type: messageTypes.SELECT_MENU, data: menuData }));
  } catch (error) {
    console.error("Error sending select menu:", error);
  }
}

function sendChecklistDepartmentSelected(ws, department) {
  try {
    ws.send(
      JSON.stringify({
        type: messageTypes.SELECT_DEPARTMENT,
        data: department,
      })
    );
  } catch (error) {
    console.error("Error sending checklist department selected:", error);
  }
}

function sendLinkDisconnected(ws) {
  try {
    ws.send(JSON.stringify({ type: messageTypes.LINK_DISCONNECTED }));
  } catch (error) {
    console.error("Error sending link disconnected:", error);
  }
}

function sendCloseDrawer(ws) {
  try {
    ws.send(JSON.stringify({ type: messageTypes.CLOSE_DRAWER }));
  } catch (error) {
    console.log("Server msg   :" + "Error sending close drawer:", error);
  }
}

module.exports = {
  sendLinkingCode,
  relayMessage,
  sendCompanionChangedDepartment,
  sendCompanionChildSelected,
  sendRequestFoodData,
  sendLinkConnected,
  sendInvalidToken,
  sendLinkSuccess,
  sendCompanionChangedDepartment,
  sendUnlinkSuccess,
  sendSelectMenu,
  sendFoodData,
  sendLinkingError,
  sendChecklistDepartmentSelected,
  sendLinkDisconnected,
  sendCloseDrawer,
};
