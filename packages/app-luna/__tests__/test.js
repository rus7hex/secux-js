import { SecuxLUNA } from "@secux/app-luna";
import { AuthInfo, Fee, MnemonicKey, RawKey, SignDoc, Tx, TxBody } from "@terra-money/terra.js";
import { Network } from "../lib/interface";
const { mnemonicToSeedSync } = require("bip39");
const { fromSeed } = require("bip32");
const { assert } = require("chai");


const mnemonic = "neither black arm fun match nominee north lock cave judge window juice humor list verify permit unfold unfair expect muscle human true spoil ancient";
const seed = mnemonicToSeedSync(mnemonic);
const root = fromSeed(seed);


const TEST_API = false;
export function test(GetDevice) {
    describe('SecuxLUNA.getAddress()', () => {
        describe("account address", () => {
            const account = RandomNumber(100);
            const path = `m/44'/330'/${account}'/0/0`;
            const accAddress = new MnemonicKey({ mnemonic, account }).accAddress;

            it("can generate address", async () => {
                const buf = SecuxLUNA.prepareAddress(path);
                const rsp = await GetDevice().Exchange(buf);
                const address = SecuxLUNA.resolveAddress(rsp);

                assert.equal(address, accAddress);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, accAddress);
            });
        });

        describe("validator address", () => {
            const account = RandomNumber(100);
            const path = `m/44'/330'/${account}'/0/0`;
            const valAddress = new MnemonicKey({ mnemonic, account }).valAddress;

            it("can generate address", async () => {
                const buf = SecuxLUNA.prepareAddress(path);
                const rsp = await GetDevice().Exchange(buf);
                const address = SecuxLUNA.resolveAddress(rsp, SecuxLUNA.AddressType.validator);

                assert.equal(address, valAddress);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path, "validator");

                assert.equal(addr, valAddress);
            });
        });

        describe("pubkey address", () => {
            const account = RandomNumber(100);
            const path = `m/44'/330'/${account}'/0/0`;
            const pubAddress = new MnemonicKey({ mnemonic, account }).publicKey.pubkeyAddress();

            it("can generate address", async () => {
                const buf = SecuxLUNA.prepareAddress(path);
                const rsp = await GetDevice().Exchange(buf);
                const address = SecuxLUNA.resolveAddress(rsp, SecuxLUNA.AddressType.pubkey);

                assert.equal(address, pubAddress);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path, "pubkey");

                assert.equal(addr, pubAddress);
            });
        });
    });

    describe('SecuxLUNA.simulate()', () => {
        describe('estimate gas', () => {
            const path = `m/44'/330'/0'/0/0`;
            const sequence = Math.round(Math.random() * 1e3);
            const amount = 100;

            it('calculate gas from api', async () => {
                const from = await GetDevice().getAddress(path);
                const transfer = new SecuxLUNA.CW20.transfer(
                    "terra1u0t35drzyy0mujj8rkdyzhe264uls4ug3wdp3x",
                    {
                        from,
                        to: await GetDevice().getAddress(`m/44'/330'/${RandomNumber(20)}'/0/${RandomNumber(20)}`),
                        amount,
                    }
                );

                const tx_bytes = SecuxLUNA.simulate(
                    [
                        {
                            sequence,
                        }
                    ],
                    [transfer]
                );

                if (TEST_API) {
                    const account = await fetch(`https://bombay-lcd.terra.dev/cosmos/auth/v1beta1/accounts/${from}`, {
                        method: "GET",
                        headers: { "Content-type": "application/json" },
                    }).then(res => res.json()).then(res => res.account);
                    const tx_bytes = SecuxLUNA.simulate(
                        [
                            {
                                sequence: parseInt(account.sequence),
                            }
                        ],
                        [transfer]
                    );

                    const response = await fetch("https://bombay-lcd.terra.dev/cosmos/tx/v1beta1/simulate", {
                        method: "POST",
                        headers: { "Content-type": "application/json" },
                        body: JSON.stringify({ tx_bytes }),
                    }).then(res => res.json());
                    const gas = response.gas_info.gas_used;

                    assert.isAbove(parseInt(gas), 0);
                }
            }).timeout(20000);
        });
    });

    describe('SecuxLUNA.signTransaction()', () => {
        describe('MsgSend', () => {
            const path = `m/44'/330'/${RandomNumber(20)}'/0/${RandomNumber(20)}`;
            const sequence = Math.round(Math.random() * 1e7);
            const account_number = Math.round(Math.random() * 1e7);
            const amount = Math.round(Math.random() * 1e10);
            const params = {
                fee: { uluna: 123 },
                gasLimit: 12345,
            };

            let signer, send;
            before(async () => {
                const from = await GetDevice().getAddress(path);
                const to = await GetDevice().getAddress(`m/44'/330'/${RandomNumber(20)}'/0/${RandomNumber(20)}`);
                send = new SecuxLUNA.MsgSend(from, to, { uluna: amount });

                signer = {
                    path,
                    accountNumber: account_number,
                    sequence,
                };
            });

            let signed;
            it('can create MsgSend transaction', async () => {
                const data = SecuxLUNA.preparePublickey(path);
                let rsp = await GetDevice().Exchange(data);
                const publickey = SecuxLUNA.resolvePublickey(rsp);

                const { commands, serialized } = SecuxLUNA.prepareSign(
                    [
                        {
                            ...signer,
                            publickey,
                        },
                    ],
                    [send],
                    params
                );
                const rspList = [];
                for (const data of commands) {
                    const rsp = await GetDevice().Exchange(data);
                    rspList.push(rsp);
                }
                signed = SecuxLUNA.resolveTransaction(rspList, serialized);

                assert.exists(signed);
            }).timeout(10000);

            it("can directly call", async () => {
                const { multi_command, serialized } = await GetDevice().sign(
                    [signer],
                    [send],
                    params
                );
                const rspList = [];
                for (const data of multi_command) {
                    const rsp = await GetDevice().Exchange(data);
                    rspList.push(rsp);
                }
                const raw_tx = SecuxLUNA.resolveTransaction(rspList, serialized);

                assert.equal(raw_tx, signed);
            }).timeout(10000);

            it('verify raw data of signed transaction', async () => {
                const tx = await sign(path, [send], { ...params, account_number, sequence });
                assert.equal(signed, tx);
            });
        });

        describe('MsgExecuteContract', () => {
            const path = `m/44'/330'/${RandomNumber(20)}'/0/${RandomNumber(20)}`;
            const sequence = Math.round(Math.random() * 1e7);
            const account_number = Math.round(Math.random() * 1e7);
            const amount = Math.round(Math.random() * 1e10);
            const params = {
                fee: { uluna: 123 },
                gasLimit: 12345,
            };

            let signer, swap;
            before(async () => {
                const from = await GetDevice().getAddress(path);
                swap = new SecuxLUNA.MsgExecuteContract(
                    from,
                    "terra156v8s539wtz0sjpn8y8a8lfg8fhmwa7fy22aff", // contract
                    {
                        swap: {
                            offer_asset: {
                                amount: amount.toString(),
                                info: {
                                    native_token: {
                                        denom: "uluna",
                                    },
                                },
                            },
                        },
                    },
                    { uluna: amount }
                );

                signer = {
                    path,
                    accountNumber: account_number,
                    sequence,
                };
            });

            let signed;
            it('can create MsgSend transaction', async () => {
                const data = SecuxLUNA.preparePublickey(path);
                let rsp = await GetDevice().Exchange(data);
                const publickey = SecuxLUNA.resolvePublickey(rsp);

                const { commands, serialized } = SecuxLUNA.prepareSign(
                    [
                        {
                            ...signer,
                            publickey,
                        },
                    ],
                    [swap],
                    params
                );
                const rspList = [];
                for (const data of commands) {
                    const rsp = await GetDevice().Exchange(data);
                    rspList.push(rsp);
                }
                signed = SecuxLUNA.resolveTransaction(rspList, serialized);

                assert.exists(signed);
            }).timeout(10000);

            it("can directly call", async () => {
                const { multi_command, serialized } = await GetDevice().sign(
                    [signer],
                    [swap],
                    params
                );
                const rspList = [];
                for (const data of multi_command) {
                    const rsp = await GetDevice().Exchange(data);
                    rspList.push(rsp);
                }
                const raw_tx = SecuxLUNA.resolveTransaction(rspList, serialized);

                assert.equal(raw_tx, signed);
            }).timeout(10000);

            it('verify raw data of signed transaction', async () => {
                const tx = await sign(path, [swap], { ...params, account_number, sequence });
                assert.equal(signed, tx);
            });
        });

        describe('Staking', () => {
            const path = `m/44'/330'/${RandomNumber(20)}'/0/${RandomNumber(20)}`;
            const sequence = Math.round(Math.random() * 1e7);
            const account_number = Math.round(Math.random() * 1e7);
            const amount = Math.round(Math.random() * 1e10);
            const params = {
                fee: { uluna: 123 },
                gasLimit: 12345,
            };

            let signer, cases = { Delegate: 0, Withdraw: 0, Undelegate: 0, Redelegate: 0 };
            before(async () => {
                signer = {
                    path,
                    accountNumber: account_number,
                    sequence,
                };

                const from = await GetDevice().getAddress(path);
                const to = await GetDevice().getAddress(`m/44'/330'/${RandomNumber(20)}'/0/${RandomNumber(20)}`);
                cases.Delegate = new SecuxLUNA.MsgDelegate(
                    from,
                    "terravaloper1vf2209f5y7s4a66n5ng7wmup5gcc2kghhzy89w",
                    amount
                );

                cases.Withdraw = new SecuxLUNA.MsgWithdrawDelegatorReward(
                    from,
                    "terravaloper1vf2209f5y7s4a66n5ng7wmup5gcc2kghhzy89w",
                );

                cases.Undelegate = new SecuxLUNA.MsgUndelegate(
                    from,
                    "terravaloper1vf2209f5y7s4a66n5ng7wmup5gcc2kghhzy89w",
                    amount
                );

                cases.Redelegate = new SecuxLUNA.MsgBeginRedelegate(
                    from,
                    "terravaloper1vf2209f5y7s4a66n5ng7wmup5gcc2kghhzy89w",
                    "terravaloper1vk20anceu6h9s00d27pjlvslz3avetkvnwmr35",
                    amount
                );
            });

            for (const key of Object.keys(cases)) {
                describe(key, () => {
                    let signed;
                    it('can create transaction', async () => {
                        const data = SecuxLUNA.preparePublickey(path);
                        let rsp = await GetDevice().Exchange(data);
                        const publickey = SecuxLUNA.resolvePublickey(rsp);

                        const { commands, serialized } = SecuxLUNA.prepareSign(
                            [
                                {
                                    ...signer,
                                    publickey,
                                },
                            ],
                            [cases[key]],
                            params
                        );
                        const rspList = [];
                        for (const data of commands) {
                            const rsp = await GetDevice().Exchange(data);
                            rspList.push(rsp);
                        }
                        signed = SecuxLUNA.resolveTransaction(rspList, serialized);

                        assert.exists(signed);
                    }).timeout(10000);

                    it("can directly call", async () => {
                        const { multi_command, serialized } = await GetDevice().sign(
                            [signer],
                            [cases[key]],
                            params
                        );
                        const rspList = [];
                        for (const data of multi_command) {
                            const rsp = await GetDevice().Exchange(data);
                            rspList.push(rsp);
                        }
                        const raw_tx = SecuxLUNA.resolveTransaction(rspList, serialized);

                        assert.equal(raw_tx, signed);
                    }).timeout(10000);

                    it('verify raw data of signed transaction', async () => {
                        const tx = await sign(path, [cases[key]], { ...params, account_number, sequence });
                        assert.equal(signed, tx);
                    });
                });
            }
        });

        describe('CW-20', () => {
            const path = `m/44'/330'/${RandomNumber(20)}'/0/${RandomNumber(20)}`;
            const sequence = Math.round(Math.random() * 1e7);
            const account_number = Math.round(Math.random() * 1e7);
            const amount = Math.round(Math.random() * 1e10);
            const params = {
                fee: { uluna: 123 },
                gasLimit: 12345,
            };

            let signer, cases = { Transfer: 0, TransferFrom: 0 };
            before(async () => {
                signer = {
                    path,
                    accountNumber: account_number,
                    sequence,
                };

                const from = await GetDevice().getAddress(path);
                const to = await GetDevice().getAddress(`m/44'/330'/${RandomNumber(20)}'/0/${RandomNumber(20)}`);
                cases.Transfer = new SecuxLUNA.CW20.transfer(
                    "terra1u0t35drzyy0mujj8rkdyzhe264uls4ug3wdp3x",
                    {
                        from,
                        to,
                        amount,
                    }
                );

                cases.TransferFrom = new SecuxLUNA.CW20.transferFrom(
                    "terra1u0t35drzyy0mujj8rkdyzhe264uls4ug3wdp3x",
                    {
                        from,
                        to,
                        amount,
                    }
                );
            });

            for (const key of Object.keys(cases)) {
                describe(key, () => {
                    let signed;
                    it('can create transaction', async () => {
                        const data = SecuxLUNA.preparePublickey(path);
                        let rsp = await GetDevice().Exchange(data);
                        const publickey = SecuxLUNA.resolvePublickey(rsp);

                        const { commands, serialized } = SecuxLUNA.prepareSign(
                            [
                                {
                                    ...signer,
                                    publickey,
                                },
                            ],
                            [cases[key]],
                            params
                        );
                        const rspList = [];
                        for (const data of commands) {
                            const rsp = await GetDevice().Exchange(data);
                            rspList.push(rsp);
                        }
                        signed = SecuxLUNA.resolveTransaction(rspList, serialized);

                        assert.exists(signed);
                    }).timeout(10000);

                    it("can directly call", async () => {
                        const { multi_command, serialized } = await GetDevice().sign(
                            [signer],
                            [cases[key]],
                            params
                        );
                        const rspList = [];
                        for (const data of multi_command) {
                            const rsp = await GetDevice().Exchange(data);
                            rspList.push(rsp);
                        }
                        const raw_tx = SecuxLUNA.resolveTransaction(rspList, serialized);

                        assert.equal(raw_tx, signed);
                    }).timeout(10000);

                    it('verify raw data of signed transaction', async () => {
                        const tx = await sign(path, [cases[key]], { ...params, account_number, sequence });
                        assert.equal(signed, tx);
                    });
                });
            }
        });
    });
}

function RandomNumber(max) {
    return Math.floor(Math.random() * max);
}

async function sign(path, messages, params) {
    const tx = new Tx(
        new TxBody(messages),
        new AuthInfo([], new Fee(params.gasLimit, params.fee)),
        []
    );

    const child = root.derivePath(path);
    const account = new RawKey(child.privateKey);
    const sig = await account.createSignatureAmino(
        new SignDoc(
            Network.Mainnet,
            params.account_number,
            params.sequence,
            tx.auth_info,
            tx.body
        )
    );
    tx.appendSignatures([sig]);

    return Buffer.from(tx.toBytes()).toString('base64');
}