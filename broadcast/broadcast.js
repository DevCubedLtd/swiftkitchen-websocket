const { messageTypes } = require("../constants/messageTypes");

function sendLinkingCode(ws, linkingCode) {
  console.log("Sending linking code: ", linkingCode);
  ws.send(
    JSON.stringify({ type: messageTypes.LINKING_CODE, code: linkingCode })
  );
}

function sendFoodData(ws, foodData) {
  ws.send(JSON.stringify({ type: messageTypes.FOOD_DATA, foodData }));
}

function sendCompanionChangedDepartment(ws, department) {
  ws.send(
    JSON.stringify({
      type: messageTypes.COMPANION_CHANGED_DEPARTMENT,
      department,
    })
  );
}

function sendCompanionChildSelected(ws, child) {
  ws.send(JSON.stringify({ type: messageTypes.CHILD_SELECTED, child }));
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

module.exports = {
  sendLinkingCode,
  sendFoodData,
  sendCompanionChangedDepartment,
  sendCompanionChildSelected,
  sendRequestFoodData,
  sendLinkConnected,
};
