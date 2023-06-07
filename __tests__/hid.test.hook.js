require("@secux/utility/lib/logger");
const { SecuxWebHID } = require("@secux/transport-webhid");


let webhid;
document.getElementById("connect").onclick =
    async () => {
        webhid = await SecuxWebHID.Create(
            () => console.log('connected'),
            () => console.log('disconnected')
        );
        await webhid.Connect();

        console.log(webhid.DeviceName);

        const id = await webhid.getCustomerId();
        console.log(`customer id: ${id}`);

        mocha.run();
    };


export function RunTest(testname, test) {
    describe(testname, () => {
        after(async () => {
            await webhid.Disconnect();
        });

        test(GetDevice);
    });
}

export const GetDevice = () => webhid;