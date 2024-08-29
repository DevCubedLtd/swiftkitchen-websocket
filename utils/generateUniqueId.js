module.exports = function generateUniqueId(companionDevices) {
  // Generate a unique identifier for a client
  // This is a simple example; you might want a more robust method
  // TODO - check it doesnt exist before sending
  return Math.random().toString(36).substr(2, 6).toLocaleUpperCase();
};
