const { RunTest, GetDevice } = require("../../../__tests__/usb.test.hook.js");
const { SecuxWebUSB } = require('../lib/transport-webusb');
const { SecuxDevice } = require('../../protocol-device');
const { assert } = require('chai');

RunTest("@secux/transport-webusb", () => {
    describe("SecuxWebUSB.isBootLoader()", () => {
        it("is not in BootLoader mode", () => {
            const isBootLoader = SecuxWebUSB.isBootLoader(GetDevice());

            assert.equal(isBootLoader, false);
        });
    });

    describe("SecuxWebUSB.isSecuXDevice()", () => {
        it("is SecuX device", () => {
            const isSecuX = SecuxWebUSB.isSecuXDevice(GetDevice());

            assert.equal(isSecuX, true);
        });
    });

    describe("SecuxDevice.getVersion()", () => {
        it('query devcie fw version', async () => {
            const { seFwVersion, mcuFwVersion, bootloaderVersion } = await SecuxDevice.getVersion(GetDevice());
    
            assert.equal(seFwVersion, '1.87');
            assert.equal(mcuFwVersion, '2.14.9');
            assert.equal(bootloaderVersion, '1.9');
        });
    });
});
