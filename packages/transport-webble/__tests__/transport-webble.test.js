const { RunTest, GetDevice } = require("../../../__tests__/ble.test.hook.js");
const { SecuxDevice } = require('../../protocol-device');
const { assert } = require('chai');


RunTest("@secux/transport-webble", () => {
    describe("SecuxDevice.getVersion()", () => {
        it('query devcie fw version', async () => {
            const { seFwVersion, mcuFwVersion, bootloaderVersion } = await SecuxDevice.getVersion(GetDevice());

            assert.equal(seFwVersion, '1.87');
            assert.equal(mcuFwVersion, '2.14.9');
            assert.equal(bootloaderVersion, '1.9');
        });
    });
});
