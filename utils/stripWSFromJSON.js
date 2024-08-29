function stripWSFromJSON(json) {
  // go through all objects and delete any with the key ws
  let keys = Object.keys(json);
  for (let key of keys) {
    if (json[key] && json[key].ws) {
      delete json[key].ws;
    }
  }
  return json;
}

module.exports = { stripWSFromJSON };
