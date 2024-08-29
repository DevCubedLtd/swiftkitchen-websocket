const { tryParseJSONObject } = require("../utils/tryParseJSONObject");
const { companionMessageHandler } = require("./companionMessageHandler");
const { checklistMessageHandler } = require("./checklistMessageHandler");

function messageHandler(
  ws,
  message,
  isBinary,
  companionDevices,
  checklistDevices
) {
  let parsedMessage = checkMessageSafety(message);
  if (!parsedMessage) return;

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
      checklistDevices,
      companionDevices
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
