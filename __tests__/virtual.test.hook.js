require("@secux/utility/lib/logger");
const { SecuxVirtualTransport } = require("@secux/transport-signer");


const mnemonic = "neither black arm fun match nominee north lock cave judge window juice humor list verify permit unfold unfair expect muscle human true spoil ancient";
// const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const signer = new SecuxVirtualTransport(mnemonic);
document.getElementById("connect").onclick = () => {
    mocha.run();
}


export function RunTest(testname, test) {
    describe(testname, () => {
        test(GetDevice);
    });
}

export const GetDevice = () => signer;