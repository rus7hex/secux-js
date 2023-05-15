require("@secux/utility/lib/logger");
const { EIP1193Provider } = require("@secux/providers");
const { SecuxVirtualTransport } = require("@secux/transport-signer");
const { assert } = require("chai");


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
        const address = "0x9858EFFD232B4033E47D90003D41EC34ECAEDA94";

        let signature;
        try {
            signature = await provider.request({
                method: "personal_sign",
                params: [address, "test message"]
            });
        } catch (error) {
            signature = await provider_test.request({
                method: "personal_sign",
                params: [address, "test message"]
            });
        }

        assert.equal(signature, "0x960e9bb7f2cdfa4325661e11218c28ab2804b8966d6529b86073886a95142c881a965b3608a573ff035a780039afcbca13be25ee57ac175dd5ca7b82b79948c61c");
    }).timeout(30000);

    it("eth_sign", async () => {
        const address = (await provider_test.request({ method: "eth_accounts" }))[0];
        const hash = "0x6d446e9e38b315e95dbf5142add220cf11ddf9602e048e19bff8c20b436918de";

        let signature;
        try {
            signature = await provider.request({
                method: "eth_sign",
                params: [address, hash]
            });
        } catch (error) {
            signature = await provider_test.request({
                method: "eth_sign",
                params: [address, hash]
            });
        }

        assert.equal(signature, "0x8804e168123d9f9a15c403be07fa3ee23ea8998d56bb895497fc93d917951714433070c9b35be0580fe0a5196a7fe63417d32b6828891998a8d7b3536142d9581b");
    }).timeout(30000);

    it("eth_signTypedData", async () => {
        const address = (await provider_test.request({ method: "eth_accounts" }))[0];
        const msgParams = [
            {
                type: 'string',
                name: 'Message',
                value: 'Hi, Alice!',
            },
            {
                type: 'uint32',
                name: 'A number',
                value: '1337',
            },
        ];

        let signature;
        try {
            signature = await provider.request({
                method: "eth_signTypedData",
                params: [msgParams, address]
            });
        } catch (error) {
            signature = await provider_test.request({
                method: "eth_signTypedData",
                params: [msgParams, address]
            });
        }

        assert.equal(signature, "0x2a5c860ee5187025b92b2f3ab9216512f34e6987f469e07872c5b16bf1065b821fd10fbd1cd260e5e37e6f5d853af1dbdd67d637b3aef78c6e27fa4abaef0a051c");
    }).timeout(30000);

    it("eth_signTypedData_v3", async () => {
        const address = (await provider_test.request({ method: "eth_accounts" }))[0];
        const msgParams = {
            types: {
                EIP712Domain: [
                    { name: 'name', type: 'string' },
                    { name: 'version', type: 'string' },
                    { name: 'chainId', type: 'uint256' },
                    { name: 'verifyingContract', type: 'address' },
                ],
                Person: [
                    { name: 'name', type: 'string' },
                    { name: 'wallet', type: 'address' },
                ],
                Mail: [
                    { name: 'from', type: 'Person' },
                    { name: 'to', type: 'Person' },
                    { name: 'contents', type: 'string' },
                ],
            },
            primaryType: 'Mail',
            domain: {
                name: 'Ether Mail',
                version: '1',
                chainId: '1',
                verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
            },
            message: {
                from: {
                    name: 'Cow',
                    wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
                },
                to: {
                    name: 'Bob',
                    wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
                },
                contents: 'Hello, Bob!',
            },
        };

        let signature;
        try {
            signature = await provider.request({
                method: "eth_signTypedData_v3",
                params: [address, msgParams]
            });
        } catch (error) {
            signature = await provider_test.request({
                method: "eth_signTypedData_v3",
                params: [address, msgParams]
            });
        }

        assert.equal(signature, "0x5b9ee7ebad3acd6ca243732900203a8a9e59b871345cb9b229a1936e11f5ad8967c46a0d05027ccd880bcc49e18877a53b8e4813558a1fd165ebb875c4a447c21c");
    }).timeout(30000);

    it("eth_signTypedData_v4", async () => {
        const address = (await provider_test.request({ method: "eth_accounts" }))[0];
        const msgParams = {
            domain: {
                chainId: '1',
                name: 'Ether Mail',
                verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
                version: '1',
            },
            message: {
                contents: 'Hello, Bob!',
                from: {
                    name: 'Cow',
                    wallets: [
                        '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
                        '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
                    ],
                },
                to: [
                    {
                        name: 'Bob',
                        wallets: [
                            '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
                            '0xB0BdaBea57B0BDABeA57b0bdABEA57b0BDabEa57',
                            '0xB0B0b0b0b0b0B000000000000000000000000000',
                        ],
                    },
                ],
            },
            primaryType: 'Mail',
            types: {
                EIP712Domain: [
                    { name: 'name', type: 'string' },
                    { name: 'version', type: 'string' },
                    { name: 'chainId', type: 'uint256' },
                    { name: 'verifyingContract', type: 'address' },
                ],
                Group: [
                    { name: 'name', type: 'string' },
                    { name: 'members', type: 'Person[]' },
                ],
                Mail: [
                    { name: 'from', type: 'Person' },
                    { name: 'to', type: 'Person[]' },
                    { name: 'contents', type: 'string' },
                ],
                Person: [
                    { name: 'name', type: 'string' },
                    { name: 'wallets', type: 'address[]' },
                ],
            },
        };

        let signature;
        try {
            signature = await provider.request({
                method: "eth_signTypedData_v4",
                params: [address, msgParams]
            });
        } catch (error) {
            signature = await provider_test.request({
                method: "eth_signTypedData_v4",
                params: [address, msgParams]
            });
        }

        assert.equal(signature, "0xa611ea8753a78f7390e5be0b1def230d1f9cb93f9a97b146f97e78df7ac44a4d14598c5b4e45bae6d9d4dc28ced3a4c0e7c8567e64714d49bfd0492329181ae61b");
    }).timeout(30000);
});
