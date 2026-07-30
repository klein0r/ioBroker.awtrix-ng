"use strict";
var import_awtrix_ng = require("./awtrix-ng");
if (require.main !== module) {
  module.exports = (options) => new import_awtrix_ng.AwtrixNg(options);
} else {
  (() => new import_awtrix_ng.AwtrixNg())();
}
//# sourceMappingURL=main.js.map
