const swcJest = require("@swc/jest");
const { config } = require("@functionless/swc-config");

function createTransformer() {
  return swcJest.createTransformer(config);
}

module.exports = { createTransformer };