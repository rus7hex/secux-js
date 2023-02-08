require("@secux/utility/lib/logger");
const { EIP1193Provider } = require("@secux/providers");
const { SecuxVirtualTransport } = require("@secux/transport-virtual");
const randomBytes = require("randombytes");


const button = document.getElementById("btn");
button.onclick = () => {
    mocha.run();
}


describe("EIP-1193 provider", () => {
    const url = "https://eth.llamarpc.com";
    const provider = new EIP1193Provider(url);
    const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const signer = new SecuxVirtualTransport(mnemonic);
    const provider_test = new EIP1193Provider(url, signer);

    it("can connect to device", done => {
        let accounts;
        button.innerText = "connect to device"
        button.onclick = async () => {
            accounts = await provider.request({
                method: "eth_requestAccounts",
                params: ["ble"]
            });
        };

        const checker = () => {
            if (accounts) {
                console.log(accounts);
                done();
                return;
            }

            setTimeout(checker, 1000);
        };
        checker();
    }).timeout(60000);

    it("eth_signTransaction", async () => {
        try {
            await provider.request({
                method: "eth_signTransaction",
                params: [
                    {
                        to: '0x000000000000000000000000000000000000dEaD'
                    }
                ]
            });
        } catch (error) {
            await provider_test.request({
                method: "eth_signTransaction",
                params: [
                    {
                        to: '0x000000000000000000000000000000000000dEaD'
                    }
                ]
            });
        }
    }).timeout(30000);

    it("eth_sendTransaction", async () => {
        try {
            await provider.request({
                method: "eth_sendTransaction",
                params: [
                    {
                        to: '0x000000000000000000000000000000000000dEaD'
                    }
                ]
            });
        } catch (error) {
            await provider_test.request({
                method: "eth_sendTransaction",
                params: [
                    {
                        to: '0x000000000000000000000000000000000000dEaD'
                    }
                ]
            });
        }
    }).timeout(30000);

    it("personal_sign", async () => {
        const address = (await provider_test.request({ method: "eth_accounts" }))[0];

        try {
            await provider.request({
                method: "personal_sign",
                params: [address, "test message"]
            });
        } catch (error) {
            await provider_test.request({
                method: "personal_sign",
                params: [address, "test message"]
            });
        }
    }).timeout(30000);

    it("eth_sign", async () => {
        const address = (await provider_test.request({ method: "eth_accounts" }))[0];

        try {
            await provider.request({
                method: "eth_sign",
                params: [address, randomBytes(32)]
            });
        } catch (error) {
            await provider_test.request({
                method: "eth_sign",
                params: [address, randomBytes(32)]
            });
        }
    }).timeout(30000);
});
