const { RunTest } = require("../../../__tests__/usb.test.hook.js");
const { test } = require("./test");


const testDFU = false;
if (!testDFU) {
    RunTest("@secux/protocol-device", test);
}
else {
    require("@secux/utility/lib/logger");

    describe("@secux/protocol-device", () => {
        test(undefined);
    });

    mocha.run();
}