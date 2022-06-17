require("@secux/utility/lib/logger");
const { SecuxWebUSB } = require("@secux/transport-webusb");


let webusb;
document.getElementById("connect").onclick =
    async () => {
        webusb = await SecuxWebUSB.Create(
            () => console.log('connected'),
            () => console.log('disconnected')
        );
        await webusb.Connect();

        console.log(webusb.DeviceName);

        mocha.run();
    };


export function RunTest(testname, test) {
    describe(testname, () => {
        after(async () => {
            await webusb.Disconnect();
        });

        test(GetDevice);
    });
}

export const GetDevice = () => webusb;