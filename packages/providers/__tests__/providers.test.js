require("@secux/utility/lib/logger");
const { EIP1193Provider } = require("@secux/providers");


const button = document.getElementById("btn");


describe("EIP-1193 provider", () => {
    const provider = new EIP1193Provider("https://eth.llamarpc.com");


    it("can request device", done => {
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
});
