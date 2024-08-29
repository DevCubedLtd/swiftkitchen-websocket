const { messageTypes } = require("../constants/messageTypes");

function sendLinkingCode(ws, linkingCode) {
  console.log("Sending linking code: ", linkingCode);
  ws.send(
    JSON.stringify({ type: messageTypes.LINKING_CODE, code: linkingCode })
  );
}

function sendFoodData(ws, foodData) {
  ws.send(JSON.stringify({ type: messageTypes.FOOD_DATA, data: foodData }));
}

function sendCompanionChangedDepartment(ws, department) {
  ws.send(
    JSON.stringify({
      type: messageTypes.COMPANION_CHANGED_DEPARTMENT,
      data: department,
    })
  );
}

function sendCompanionChildSelected(ws, child) {
  ws.send(JSON.stringify({ type: messageTypes.CHILD_SELECTED, data: child }));
}

function sendRequestFoodData(ws) {
  ws.send(JSON.stringify({ type: messageTypes.REQUEST_FOOD_DATA }));
}

function sendInvalidToken(ws) {
  ws.send(
    JSON.stringify({
      type: messageTypes.LINKING_ERROR,
      message: "Invalid access token",
    })
  );
}

function sendLinkingError(ws, message) {
  ws.send(JSON.stringify({ type: messageTypes.LINKING_ERROR, message }));
}

function sendLinkConnected(ws) {
  ws.send(JSON.stringify({ type: messageTypes.LINK_CONNECTED }));
}

function sendLinkSuccess(ws, deviceId, accessToken) {
  ws.send(
    JSON.stringify({
      type: messageTypes.LINK_SUCCESS,
      deviceId,
      accessToken,
    })
  );
}

function sendUnlinkSuccess(ws) {
  ws.send(JSON.stringify({ type: messageTypes.UNLINK_SUCCESS }));
}

function sendCompanionChangedDepartment(ws, changeDeparmentData) {
  ws.send(
    JSON.stringify({
      type: messageTypes.COMPANION_CHANGED_DEPARTMENT,
      data: changeDeparmentData,
    })
  );
}

function sendSelectMenu(ws, menuData) {
  ws.send(JSON.stringify({ type: messageTypes.SELECT_MENU, data: menuData }));
}

function sendFoodData(ws, foodData) {
  ws.send(JSON.stringify({ type: messageTypes.FOOD_DATA, data: foodData }));
}

function sendChecklistDepartmentSelected(ws, department) {
  ws.send(
    JSON.stringify({
      type: messageTypes.SELECT_DEPARTMENT,
      data: department,
    })
  );
}

function sendLinkDisconnected(ws) {
  ws.send(JSON.stringify({ type: messageTypes.LINK_DISCONNECTED }));
}

module.exports = {
  sendLinkingCode,
  sendFoodData,
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
};
