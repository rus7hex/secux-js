const { RunTest, GetDevice } = require("../../../__tests__/hid.test.hook.js");
const randomBytes = require("randombytes");
const { assert } = require('chai');

RunTest("@secux/transport-webusb", () => {
    describe("SecuxWebHID.isSecuXDevice()", () => {
        it("is SecuX device", () => {
            const isSecuX = GetDevice().isSecuXDevice();
            assert.equal(isSecuX, true);
        });
    });

    describe("Protocol", () => {
        it("can exchange data", async () => {
            const payload = randomBytes(32);
            const data = Buffer.from([0xf8, 0x08, ...payload]);
            const rsp = await GetDevice().Exchange(data);

            assert.equal(rsp.slice(2).toString("hex"), payload.toString("hex"));
        }).timeout(20000);

        it("can exchange large data", async () => {
            const payload = randomBytes(4000);
            const data = Buffer.from([0xf8, 0x08, ...payload]);
            const rsp = await GetDevice().Exchange(data);

            assert.equal(rsp.slice(2).toString("hex"), payload.toString("hex"));
        }).timeout(20000);
    });

    describe("Device Information", () => {
        it("model", () => {
            const { Model } = GetDevice();
            console.log("model:", Model);
            assert.notEqual(Model, '');
        });

        it("device id", () => {
            const { DeviceId } = GetDevice();
            console.log("device id:", DeviceId);
            assert.notEqual(DeviceId, '');
        });

        it("customer id", () => {
            const { CustomerId } = GetDevice();
            console.log("customer id:", CustomerId);
            assert.notEqual(CustomerId, '');
        });
    });
});
