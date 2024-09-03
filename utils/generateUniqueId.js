module.exports = function generateUniqueId(companionDevices) {
  // Generate a unique identifier for a client
  // This is a simple example; you might want a more robust method
  // TODO - check it doesnt exist before sending

  let keys = Object.keys(companionDevices);
  let ids = [];
  keys.forEach((device) => {
    if (device?.linkingCode) {
      ids.push(device.linkingCode);
    }
  });

  let newId;
  do {
    newId = Math.random().toString().substring(2, 8);
  } while (ids.includes(newId));
  return newId;
};
