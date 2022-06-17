const { SecuxBTC, CoinType, ScriptType } = require("@secux/app-btc");
const { getDefaultScript } = require("@secux/app-btc/lib/utils");
const btc = require("bitcoinjs-lib");
const { validate } = require("multicoin-address-validator");
const { txCheck, decode } = require("./decoder");
const { assert } = require("chai");


const BROADCAST = false;
export function test_address(GetDevice, root) {
    describe("BTC address", () => {
        describe("native segwit address", () => {
            const path = `m/84'/0'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);

            const expected = btc.payments.p2wpkh({ pubkey: child.publicKey, network: btc.networks.bitcoin }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxBTC.prepareAddress(path, { coin: CoinType.BITCOIN, script: ScriptType.P2WPKH });
                const rsp = await GetDevice().Exchange(data);
                address = SecuxBTC.resolveAddress(rsp, path);

                assert.equal(address, expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "BTC");

                assert.equal(valid, true);
                assert.equal(address.startsWith("bc1"), true);
            });
        });

        describe("segwit address", () => {
            const path = `m/49'/0'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);

            const p2wpkh = btc.payments.p2wpkh({ pubkey: child.publicKey, network: btc.networks.bitcoin });
            const expected = btc.payments.p2sh({ redeem: p2wpkh, network: btc.networks.bitcoin }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxBTC.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxBTC.resolveAddress(rsp, path);

                assert.equal(address, expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "BTC");

                assert.equal(valid, true);
                assert.equal(address.startsWith("3"), true);
            });
        });

        describe("legacy address", () => {
            const path = `m/44'/0'/${RandomNumber(100)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);
            const expected = btc.payments.p2pkh({ pubkey: child.publicKey, network: btc.networks.bitcoin }).address;

            let address;
            it("query address from device", async () => {
                const data = SecuxBTC.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxBTC.resolveAddress(rsp, path);

                assert.equal(address, expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "BTC");

                assert.equal(valid, true);
                assert.equal(address.startsWith("1"), true);
            });
        });
    });
}

export function test_tx(GetDevice, root) {
    describe("BTC transaction", () => {
        describe("p2pkh", () => {
            const inputs = [
                {
                    hash: "0b062e71e165fba9634d9fb1b5ba703e774bf374815b1f5a617c8d1e7d43dc01",
                    vout: 0,
                    txHex: "0100000001b103a004f672080ceae8277e83c296b5ac090ae78157979211da3e2d41399d1b010000006b483045022100f19d88e6a17789dc399ff2a93b4516bb44af32928d4986138f1a4f7f37ab277b022046fc14c958bc8aa97fea1d2fbf80982534cf51634d46c4d5178e5ca6698bca07012102f8667cfb5b80c3695e3f0c9078589cb04e8d15e71bdae89ebf24b82f9d663d5cffffffff02bc020000000000001976a9145c592f40134c6179a1ce5b06b28d5c2ae443113188ac00040000000000001976a9146d65ced4ef49e23cdbb4be9d510b38e5be28e10688ac00000000",
                    satoshis: 700,
                    path: "m/44'/0'/0'/0/0"
                },
                {
                    hash: "a8c401f524fe7dc4f894b71cd64febed5b553ef5a72fd74a95d9f223f72618d6",
                    vout: 0,
                    txHex: "01000000016d30aeabd11f1fee51b8e1050dae5228c180b85b06818bfb599dae8d950e7eb4010000006b483045022100975f9837d1bf2b5bcc09a75d74ddeca2e845acee4f67bfb4070c8550adf1b44002202f27f59813387e1178f0395395c5bd2752306766234ed8b234abdf0835593d840121035448ae02dcd6829f8c8019e4915e93e8b56a926b0c2acb84de83e9a1c7e6594dffffffff02e8030000000000001976a9145c592f40134c6179a1ce5b06b28d5c2ae443113188acc8b90200000000001976a9148f2a1ea46a4fefc0f7cfa1de8b4cd2969f575d0088ac00000000",
                    satoshis: 1000,
                    path: "m/44'/0'/0'/0/0"
                }
            ];
            const outputs = [
                {
                    address: "3HrWdvTi1167JPXFXcXrm2K3BPp3e9HM4k",
                    satoshis: 100
                },
                {
                    path: "m/44'/0'/0'/0/0",
                    satoshis: 1500
                }
            ];

            let signed;
            it("can sign transaction", async () => {
                for (const x of inputs) {
                    const data = SecuxBTC.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBTC.resolvePublickey(rsp);
                }

                for (const x of outputs) {
                    if (x.path === undefined) continue;

                    const data = SecuxBTC.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBTC.resolvePublickey(rsp);
                }

                const { commandData, rawTx } = SecuxBTC.prepareSign(inputs, { to: outputs[0], utxo: outputs[1] });
                const rsp = await GetDevice().Exchange(commandData);
                signed = SecuxBTC.resolveTransaction(rsp, rawTx, inputs.map(x => x.publickey));

                assert.exists(signed);
            }).timeout(10000);

            it("can directly call", async () => {
                for (const x of inputs) delete x.publickey;
                for (const x of outputs) delete x.publickey;
                const { raw_tx } = await GetDevice().sign(inputs, { to: outputs[0], utxo: outputs[1] });

                assert.equal(raw_tx, signed);
            }).timeout(10000);

            it("check raw data of signed transaction", async () => {
                const psbt = new btc.Psbt({ network: btc.networks.bitcoin });
                for (const input of inputs) {
                    const tmp = getInputData(input, root, btc.networks.bitcoin);
                    psbt.addInput(tmp);
                }
                psbt.addOutputs(outputs.map(x => getOutputData(x, root, btc.networks.bitcoin)));

                inputs.map((input, i) => {
                    const prv = root.derivePath(input.path).privateKey;
                    psbt.signInput(i, btc.ECPair.fromPrivateKey(prv));
                });

                const expected = psbt
                    .finalizeAllInputs()
                    .extractTransaction(true)
                    .toHex();

                txCheck(signed, expected, inputs, outputs);
            }).timeout(10000);
        });

        describe("p2sh(p2wpkh)", () => {
            const inputs = [
                {
                    hash: "a817d17087d860d6c4553d77c178fecc6d1f3380b6bdd93e4d9e77de6c9b9330",
                    vout: 0,
                    // can ignore "txHex" for P2SH(P2WPKH)
                    txHex: "0100000000010286091fe9ffa4547fb04f46c6688cf403ccdac67d3ac845bae797e915c6c5a62600000000171600144b021e734ceacb73cf882c1b005b3e33362a7cbfffffffff6d5db08ff4fef23ed84e8f81ebd682a6a634143eccfa956c68f4d2ccaf4d6d640000000017160014d602f143f5b8ce86ae53f55b13cf173265f20ff2ffffffff02102700000000000017a914b14db996e5c602701e0a0ba75032ae6e0f164c5387775100000000000017a9149009e51f784ddc70059eb31ba8aff2635fa49efa8702483045022100c69d4fac75a743a0ba86e91647a3cd97fb61c5f6bd74954ea40aa0c41e2a883e02207f4401ec1509077b07945152a16effdcbaf2f1d034d05770293b920f39170cb801210241969f2aaf1399b3500f400b0fb35a7c94ac59f202a565130207ee2d8e6740ea02483045022100dc2bac35456be5132a81e1a9780ab8d0d3c0266d8b405b779a6d3ff653c9640a0220316226bd9a4ff74e7e968352431dcb89cd878711db0064da841a8a4b0adc1b500121029936e65b71bf6e08c5d3a47c7f7b15bac522e657c05ba73c16de5367c86b3c8a00000000",
                    script: ScriptType.P2SH_P2WPKH,
                    satoshis: 10000,
                    path: "m/49'/0'/0'/0/0"
                },
                {
                    hash: "07ad0a13e501d292bc8b9e16a3a8b62f99f77ab9e37ea8d3b8453984a2899984",
                    vout: 0,
                    // can ignore "txHex" for P2SH(P2WPKH)
                    txHex: "01000000000101dfbe0a20f4c5bb77019c02aa546cdc5f9140a7de120d07ca9f1eab739228a1200100000017160014604ca519a42dd6c8228e070b0dfd81f64d26bb81ffffffff02701700000000000017a914b14db996e5c602701e0a0ba75032ae6e0f164c538799bc00000000000017a9147b70abf259a0222f041d826a0a826b574aeb39ef8702483045022100903f20df7f452b44b2b0e0a65b0d41af1f65e45a2d260799bedab34f8eb0852102200997906964aa1a926153bc805d9c12110dcfa1384596fdc89bab549bfe89762601210304f3a1ef7b3b7eb6a184f9b4b3d45ab6bfc486a7c787c84593377691ba9eba1500000000",
                    script: ScriptType.P2SH_P2WPKH,
                    satoshis: 6000,
                    path: "m/49'/0'/0'/0/0"
                },
                {
                    hash: "20a1289273ab1e9fca070d12dea740915fdc6c54aa029c0177bbc5f4200abedf",
                    vout: 0,
                    // can ignore "txHex" for P2SH(P2WPKH)
                    txHex: "010000000001014975ac8ac93955cc8b602ed7f10c6ed22ac70450e6a0c8c80bc35cce0c20c2020100000017160014604ca519a42dd6c8228e070b0dfd81f64d26bb81ffffffff02204e00000000000017a914b50ba89aedac3b0e430686c69a8704a5f968af7887b9dd00000000000017a914c584c16c3a72840b4f488c6da78538c9cd455d6f8702473044022010ad40322731bd89e57317523ca6a6ead15e6eb0eab537a7eb2dabb4f9fa643602207d131f579f139a63120e80303c81728507607bed91559e9e90f0e42fbdb5c1ab01210304f3a1ef7b3b7eb6a184f9b4b3d45ab6bfc486a7c787c84593377691ba9eba1500000000",
                    script: ScriptType.P2SH_P2WPKH,
                    satoshis: 20000,
                    path: "m/49'/0'/1'/0/0"
                },
            ];
            const outputs = [
                {
                    address: "19RJ1JTm7qkLeC5pCRPwsc7Ynx9eijZbvQ",
                    satoshis: 100
                },
                {
                    script: ScriptType.P2SH_P2WPKH,
                    path: `m/49'/0'/0'/0/${RandomNumber(20)}`,
                    satoshis: 35900,
                }
            ];

            let signed;
            it("can sign transaction", async () => {
                for (let x of inputs) {
                    const data = SecuxBTC.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBTC.resolvePublickey(rsp);
                }

                for (let x of outputs) {
                    if (x.path === undefined) continue;

                    const data = SecuxBTC.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBTC.resolvePublickey(rsp);
                }

                const { commandData, rawTx } = SecuxBTC.prepareSign(inputs, { to: outputs[0], utxo: outputs[1] });
                const rsp = await GetDevice().Exchange(commandData);
                signed = SecuxBTC.resolveTransaction(rsp, rawTx, inputs.map(x => x.publickey));

                assert.exists(signed);
            }).timeout(10000);

            it("can directly call", async () => {
                for (const x of inputs) delete x.publickey;
                for (const x of outputs) delete x.publickey;
                const { raw_tx } = await GetDevice().sign(inputs, { to: outputs[0], utxo: outputs[1] });

                assert.equal(raw_tx, signed);
            }).timeout(10000);

            it("check raw data of signed transaction", async () => {
                const psbt = new btc.Psbt({ network: btc.networks.bitcoin });

                for (const input of inputs) {
                    const tmp = getInputData(input, root, btc.networks.bitcoin);
                    psbt.addInput(tmp);
                }
                psbt.addOutputs(outputs.map(x => getOutputData(x, root, btc.networks.bitcoin)));

                inputs.map((input, i) => {
                    const prv = root.derivePath(input.path).privateKey;
                    psbt.signInput(i, btc.ECPair.fromPrivateKey(prv));
                });

                const expected = psbt
                    .finalizeAllInputs()
                    .extractTransaction(true)
                    .toHex();

                txCheck(signed, expected, inputs, outputs);
            }).timeout(10000);
        });

        describe("multi-type", () => {
            const inputs = [
                {
                    hash: "a817d17087d860d6c4553d77c178fecc6d1f3380b6bdd93e4d9e77de6c9b9330",
                    vout: 0,
                    // can ignore "txHex" for P2SH(P2WPKH)
                    txHex: "0100000000010286091fe9ffa4547fb04f46c6688cf403ccdac67d3ac845bae797e915c6c5a62600000000171600144b021e734ceacb73cf882c1b005b3e33362a7cbfffffffff6d5db08ff4fef23ed84e8f81ebd682a6a634143eccfa956c68f4d2ccaf4d6d640000000017160014d602f143f5b8ce86ae53f55b13cf173265f20ff2ffffffff02102700000000000017a914b14db996e5c602701e0a0ba75032ae6e0f164c5387775100000000000017a9149009e51f784ddc70059eb31ba8aff2635fa49efa8702483045022100c69d4fac75a743a0ba86e91647a3cd97fb61c5f6bd74954ea40aa0c41e2a883e02207f4401ec1509077b07945152a16effdcbaf2f1d034d05770293b920f39170cb801210241969f2aaf1399b3500f400b0fb35a7c94ac59f202a565130207ee2d8e6740ea02483045022100dc2bac35456be5132a81e1a9780ab8d0d3c0266d8b405b779a6d3ff653c9640a0220316226bd9a4ff74e7e968352431dcb89cd878711db0064da841a8a4b0adc1b500121029936e65b71bf6e08c5d3a47c7f7b15bac522e657c05ba73c16de5367c86b3c8a00000000",
                    satoshis: 10000,
                    path: "m/49'/0'/0'/0/0"
                },
                {
                    hash: "29a7f11b83d4cf0764e751248e9199bf6d8daac5e87f9d0afbce3deb5fbd9300",
                    vout: 0,
                    txHex: "010000000001012f2424cbd13a4f1534b6a5656b582fab1fb7d276e44ee7e59007f28120e980e50000000017160014d6eed85e66fc35a98f83e7561be9f7e6537118acffffffff02204e0000000000001976a914c2b3c567a9403c020e45abe2dae44cb29592e6b088ac302300000000000017a914c6f51e2e663f2e3fb3447665dc9651b3f914a9df870247304402205f5a1204247c787192ea817e5f04fe5001d1e22831c693c32b5d567a8582433c02204cef2a923fbd8090dbb8bc82c32aa920a70c43305ba490407b04413d642e0d850121027df045cc3c4b6f6f2f554202fcd9d85111e5f8522296e0aaa5505a22ac71029700000000",
                    satoshis: 20000,
                    path: "m/44'/0'/1'/0/0"
                },
                {
                    hash: "20a1289273ab1e9fca070d12dea740915fdc6c54aa029c0177bbc5f4200abedf",
                    vout: 0,
                    // can ignore "txHex" for P2SH(P2WPKH)
                    txHex: "010000000001014975ac8ac93955cc8b602ed7f10c6ed22ac70450e6a0c8c80bc35cce0c20c2020100000017160014604ca519a42dd6c8228e070b0dfd81f64d26bb81ffffffff02204e00000000000017a914b50ba89aedac3b0e430686c69a8704a5f968af7887b9dd00000000000017a914c584c16c3a72840b4f488c6da78538c9cd455d6f8702473044022010ad40322731bd89e57317523ca6a6ead15e6eb0eab537a7eb2dabb4f9fa643602207d131f579f139a63120e80303c81728507607bed91559e9e90f0e42fbdb5c1ab01210304f3a1ef7b3b7eb6a184f9b4b3d45ab6bfc486a7c787c84593377691ba9eba1500000000",
                    satoshis: 20000,
                    path: "m/49'/0'/1'/0/0"
                },
            ];
            const outputs = [
                {
                    address: "19RJ1JTm7qkLeC5pCRPwsc7Ynx9eijZbvQ",
                    satoshis: 11111
                },
                {
                    path: `m/49'/0'/0'/0/${RandomNumber(20)}`,
                    satoshis: 15900,
                }
            ];

            let signed;
            it("can sign transaction", async () => {
                for (let x of inputs) {
                    const data = SecuxBTC.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBTC.resolvePublickey(rsp);
                }

                for (let x of outputs) {
                    if (x.path === undefined) continue;

                    const data = SecuxBTC.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBTC.resolvePublickey(rsp);
                }

                const { commandData, rawTx } = SecuxBTC.prepareSign(inputs, { to: outputs[0], utxo: outputs[1] });
                const rsp = await GetDevice().Exchange(commandData);
                signed = SecuxBTC.resolveTransaction(rsp, rawTx, inputs.map(x => x.publickey));

                assert.exists(signed);
            }).timeout(10000);

            it("can directly call", async () => {
                for (const x of inputs) delete x.publickey;
                for (const x of outputs) delete x.publickey;
                const { raw_tx } = await GetDevice().sign(inputs, { to: outputs[0], utxo: outputs[1] });

                assert.equal(raw_tx, signed);
            }).timeout(10000);

            it("check raw data of signed transaction", async () => {
                const psbt = new btc.Psbt({ network: btc.networks.bitcoin });

                for (const input of inputs) {
                    const tmp = getInputData(input, root, btc.networks.bitcoin);
                    psbt.addInput(tmp);
                }
                psbt.addOutputs(outputs.map(x => getOutputData(x, root, btc.networks.bitcoin)));

                inputs.map((input, i) => {
                    const prv = root.derivePath(input.path).privateKey;
                    psbt.signInput(i, btc.ECPair.fromPrivateKey(prv));
                });

                const expected = psbt
                    .finalizeAllInputs()
                    .extractTransaction(true)
                    .toHex();

                txCheck(signed, expected, inputs, outputs);
            }).timeout(10000);
        });

        describe("p2wpkh", () => {
            const inputs = [
                {
                    hash: "8686aee2b9dcf559798b9718ed26ca92e0c64bef11c433e576cae658678c497d",
                    vout: 1,
                    // can ignore "txHex" for P2WPKH
                    txHex: "01000000000103de969082d54bf271a31ef47a28fb38b980c21bc6506c9cf5a050d568f798e9c80000000017160014ba24c6f5fc41734c407372ecc754ff6afcbdc903ffffffff291a80351171ce9ef055f4373f582df51d4223def35bc05ed2cd3586f5b763dc0100000017160014dbccf4b8cfaf01e96f5a0832f086eed6b34ed0c4ffffffffa448f465c3ac975c391ce37f16f003767dae6e0d038b839c4acd056ccc2d349a00000000171600140b6c343f494384c2da5f175f279c62998e6b458effffffff02580200000000000017a914b14db996e5c602701e0a0ba75032ae6e0f164c53873b04000000000000160014771f04a6fcffb471479965d8b3d645faacf0a1b202473044022048d587d85ea5e47f953bcb6f6f9ddca5999e12bc6d32ccdc3b7ccd38881ad69002202549308a2071d26c6444dd1b8e437e23edd8b922b129182625223e18ea40d8e70121026924dfa245ae9d1e97f47f797458701b23b89e8afcd361f67cfdb62909989a8f02483045022100b686dc1571c025f3e2043b6d35df8dd09519bbfbf7c343248f7545f767d35eff02202bf4f2d265a40d2ae5d70fdc83573d5d04f9019fa0679846d9fb2a8bf126c0ae012102814dae0a85e5864e80832cce263c6caaa0db5d0d524ef3b34c65f9636baa01430247304402202968540a0312d30e15dd20af54dbf28f1fd3901821f9a85ea5535cb4b5868c3c02207d9947c5eec2247b671ab6060506cef8408e29e2bbdc8b97313141f91355d107012103f5f8f10277062a7d8f0f65fd9997a74fd4d94be0a5c0b2e148ac2f377cb33ec800000000",
                    satoshis: 1083,
                    path: "m/84'/0'/0'/1/0"
                }
            ];
            const outputs = [
                {
                    address: "bc1qs0k3ekx0z7a7yuq3lse7prw373s8cr8lhxvccd",
                    satoshis: 1000
                },
                {
                    path: `m/49'/0'/0'/0/${RandomNumber(20)}`,
                    satoshis: 50
                }
            ];

            let signed;
            it("can sign transaction", async () => {
                for (let x of inputs) {
                    const data = SecuxBTC.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBTC.resolvePublickey(rsp);
                }

                for (let x of outputs) {
                    if (x.path === undefined) continue;

                    const data = SecuxBTC.preparePublickey(x.path);
                    const rsp = await GetDevice().Exchange(data);
                    x.publickey = SecuxBTC.resolvePublickey(rsp);
                }

                const { commandData, rawTx } = SecuxBTC.prepareSign(inputs, { to: outputs[0], utxo: outputs[1] });
                const rsp = await GetDevice().Exchange(commandData);
                signed = SecuxBTC.resolveTransaction(rsp, rawTx, inputs.map(x => x.publickey));

                assert.exists(signed);
            }).timeout(10000);

            it("can directly call", async () => {
                for (const x of inputs) delete x.publickey;
                for (const x of outputs) delete x.publickey;
                const { raw_tx } = await GetDevice().sign(inputs, { to: outputs[0], utxo: outputs[1] });

                assert.equal(raw_tx, signed);
            }).timeout(10000);

            it("check raw data of signed transaction", async () => {
                const psbt = new btc.Psbt({ network: btc.networks.bitcoin });
                for (const input of inputs) {
                    const tmp = getInputData(input, root, btc.networks.bitcoin);
                    psbt.addInput(tmp);
                }
                psbt.addOutputs(outputs.map(x => getOutputData(x, root, btc.networks.bitcoin)));

                inputs.map((input, i) => {
                    const prv = root.derivePath(input.path).privateKey;
                    psbt.signInput(i, btc.ECPair.fromPrivateKey(prv));
                });

                const expected = psbt
                    .finalizeAllInputs()
                    .extractTransaction(true)
                    .toHex();

                txCheck(signed, expected, inputs, outputs);
            }).timeout(10000);
        });

        if (BROADCAST) {
            describe("broadcast with all types", () => {
                const inputs = [
                    {
                        hash: "8686aee2b9dcf559798b9718ed26ca92e0c64bef11c433e576cae658678c497d",
                        vout: 1,
                        satoshis: 1083,
                        path: "m/84'/0'/0'/1/0"
                    },
                    {
                        hash: "c6952dfbf055d100f69eb5b41514a346c9da13b6defe8856b486fb007a6b5401",
                        vout: 0,
                        txHex: "02000000000101acf46606ff0a6cf8fe890e58023ff751114067ceef3159ff4f552e03a82172770000000017160014cc54043bfa8d1d6b518a6e4fc3e474dadc23713effffffff0222020000000000001976a9145c592f40134c6179a1ce5b06b28d5c2ae443113188ac1d2d00000000000017a9147b70abf259a0222f041d826a0a826b574aeb39ef8702473044022001d706b853f066999828b802b91083478943c72dc050682e4e8d51f638ae6d94022017408215a444fe461700d204139d17d386237f50d219fb19162d40d51328562301210355fe93d3d4533397c60f39ffecfbb0b9ad4df1a99afdbc6bcda751b2f4f16b4800000000",
                        satoshis: 546,
                        path: "m/44'/0'/0'/0/0"
                    },
                    {
                        hash: "c6952dfbf055d100f69eb5b41514a346c9da13b6defe8856b486fb007a6b5401",
                        vout: 1,
                        satoshis: 11549,
                        path: "m/49'/0'/1'/1/0"
                    }
                ];
                const outputs = [
                    {
                        address: "bc1qs0k3ekx0z7a7yuq3lse7prw373s8cr8lhxvccd",
                        satoshis: 1920
                    },
                    {
                        path: `m/49'/0'/0'/1/0`,
                        satoshis: 8000
                    }
                ];

                let signed;
                it("can sign transaction", async () => {
                    signed = await SecuxBTC.signTransaction(GetDevice(), inputs, { to: outputs[0], utxo: outputs[1] });

                    assert.exists(signed);
                    assert.equal(signed.raw_tx, "020000000001037d498c6758e6ca76e533c411ef4bc6e092ca26ed18978b7959f5dcb9e2ae86860100000000ffffffff01546b7a00fb86b45688fedeb613dac946a31415b4b59ef600d155f0fb2d95c6000000006b483045022100cd9386ca4de4d13423cabcd5f146a545856af0560127aa497f47cab2b0ec8783022025e4924f3faf39733d48ff89a945114b041a7e84c87826f9bebeba7380463583012103d70e78115a73990a1ca8829694cc9b9804f668059bc01ec70fd7363a29c5b0caffffffff01546b7a00fb86b45688fedeb613dac946a31415b4b59ef600d155f0fb2d95c60100000017160014e63a4ece8a1971770b922f110cbdbaf6672b8984ffffffff02800700000000000016001483ed1cd8cf17bbe27011fc33e08dd1f4607c0cff401f00000000000017a9141bc2a2ec0c552417af3169eb8db36f8e5ff15ed68702483045022100edbdb72c74ba84f7d99935f757d3097783a342a8b0b70b673cc72bedfb2e38eb022059de51549b5ccb9c706273fb04d33426a83b427a49540641dd347412ba772f9e012103e2791fa0d823d1d444eef64af8f1befde254f11479b2a976992a9dda054c1c9c000247304402205cf3c7e07bb46f50a03e51ebd0d9191710e24ba55bd47fea978958dbaed84d19022049b02de6447a383e65ba926b9626c28998eff8e0d0072e8a579ec89994ce11e301210352fc2090d08764b5883e8a7e211192bab361fe49ffafaa60070b7d41409ec17e00000000");

                    const response = await fetch("https://api.blockchair.com/bitcoin/push/transaction", {
                        method: "POST",
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ data: signed.raw_tx })
                    });
                    console.log(await response.json());
                }).timeout(60000);
            });
        }
    });
}

export function getInputData(
    input,
    root,
    network,
) {
    let tp = "p2pkh";
    let isSegwit = false;
    let redeemType = "noredeem";
    switch (input.script ?? getDefaultScript(input.path)) {
        case ScriptType.P2SH_P2WPKH:
            tp = "p2sh-p2wpkh";
            isSegwit = true;
            redeemType = "p2sh";
            break;

        case ScriptType.P2SH_P2PKH:
            tp = "p2sh-p2pkh";
            isSegwit = false;
            redeemType = "p2sh";
            break;

        case ScriptType.P2WPKH:
            tp = "p2wpkh";
            isSegwit = true;
            redeemType = "noredeem";
            break;
    }
    const payment = createPayment(tp, [root.derivePath(input.path)], network).payment;

    const mixin = isSegwit ? { witnessUtxo: getWitnessUtxo(input.txHex, input.vout) } : { nonWitnessUtxo: Buffer.from(input.txHex, "hex") };

    const mixin2 = {};
    switch (redeemType) {
        case 'p2sh':
            mixin2.redeemScript = payment.redeem.output;
            break;
        case 'p2wsh':
            mixin2.witnessScript = payment.redeem.output;
            break;
        case 'p2sh-p2wsh':
            mixin2.witnessScript = payment.redeem.redeem.output;
            mixin2.redeemScript = payment.redeem.output;
            break;
    }
    return {
        hash: input.hash,
        index: input.vout,
        ...mixin,
        ...mixin2,
    };
}

function getWitnessUtxo(txHex, vout) {
    const decoded = decode(txHex);

    return {
        script: decoded.outs[vout].scriptBuffer,
        value: decoded.outs[vout].value
    };
}

function RandomNumber(max) {
    return Math.floor(Math.random() * max).toString();
}

export function createPayment(_type, myKeys, network) {
    const splitType = _type.split('-').reverse();
    const isMultisig = splitType[0].slice(0, 4) === 'p2ms';
    const keys = myKeys || [];
    let m;
    if (isMultisig) {
        const match = splitType[0].match(/^p2ms\((\d+) of (\d+)\)$/);
        m = parseInt(match[1], 10);
        let n = parseInt(match[2], 10);
        if (keys.length > 0 && keys.length !== n) {
            throw new Error('Need n keys for multisig');
        }
        while (!myKeys && n > 1) {
            keys.push(btc.ECPair.makeRandom({ network }));
            n--;
        }
    }
    if (!myKeys) keys.push(btc.ECPair.makeRandom({ network }));

    let payment;
    splitType.forEach(type => {
        if (type.slice(0, 4) === 'p2ms') {
            payment = btc.payments.p2ms({
                m,
                pubkeys: keys.map(key => key.publicKey).sort((a, b) => a.compare(b)),
                network,
            });
        } else if (['p2sh', 'p2wsh'].indexOf(type) > -1) {
            payment = (btc.payments)[type]({
                redeem: payment,
                network,
            });
        } else {
            payment = (btc.payments)[type]({
                pubkey: keys[0].publicKey,
                network,
            });
        }
    });

    return {
        payment,
        keys,
    };
}

export function getOutputData(output, root, network) {
    if (output.address) {
        return {
            address: output.address,
            value: output.satoshis
        }
    }

    if (output.path) {
        const child = root.derivePath(output.path);

        switch (output.script ?? getDefaultScript(output.path)) {
            case ScriptType.P2SH_P2WPKH:
                return {
                    script: createPayment("p2sh-p2wpkh", [child], network).payment.output,
                    value: output.satoshis
                }

            case ScriptType.P2SH_P2PKH:
                return {
                    script: createPayment("p2sh-p2pkh", [child], network).payment.output,
                    value: output.satoshis
                }

            case ScriptType.P2WPKH:
                return {
                    script: createPayment("p2wpkh", [child], network).payment.output,
                    value: output.satoshis
                }

            default:
                return {
                    script: createPayment("p2pkh", [child], network).payment.output,
                    value: output.satoshis
                }
        }
    }

    return {
        script: output.script,
        value: output.satoshis
    }
}

