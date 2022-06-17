const { SecuxBNB } = require("@secux/app-bnb");
const { assert } = require("chai");
const { mnemonicToSeedSync } = require("bip39");
const { fromSeed } = require("bip32");
import { crypto, Transaction, types } from '@binance-chain/javascript-sdk';
const { BigNumber } = require('bignumber.js');
const decoder = require("raw-transaction-hex-decoder");


const mnemonic = "neither black arm fun match nominee north lock cave judge window juice humor list verify permit unfold unfair expect muscle human true spoil ancient";
const seed = mnemonicToSeedSync(mnemonic);
const root = fromSeed(seed);


const BROADCAST = false;
export function test(GetDevice) {
    describe('SecuxBNB.getAddress()', () => {
        const path = `m/44'/714'/${RandomNumber(20)}'/0/${RandomNumber(20)}`;
        const child = root.derivePath(path);
        const expected = crypto.getAddressFromPublicKey(child.publicKey.toString("hex"), "bnb");

        let address;
        it('query a BNB address', async () => {
            const data = SecuxBNB.prepareAddress(path);
            const rsp = await GetDevice().Exchange(data);
            address = SecuxBNB.resolveAddress(rsp);

            assert.equal(address, expected);
        });

        it("can directly call", async () => {
            const addr = await GetDevice().getAddress(path);

            assert.equal(addr, address);
        });

        it("is valid address", () => {
            assert.equal(address.startsWith("bnb"), true);
        });
    });

    describe('SecuxBNB.signTransaction()', async () => {
        const path = `m/44'/714'/${RandomNumber(20)}'/0/${RandomNumber(20)}`;

        let from, to;
        const sequence = Math.random() * 1e7;
        const account_number = Math.random() * 1e7;
        const amount = Math.random() * 1e18;
        before(async () => {
            from = await GetDevice().getAddress(path);
            to = await GetDevice().getAddress(`m/44'/714'/${RandomNumber(20)}'/0/${RandomNumber(20)}`);
        });

        let signed;
        it('can create transfer-type transaction', async () => {
            const data = SecuxBNB.preparePublickey(path);
            let rsp = await GetDevice().Exchange(data);
            const publickey = SecuxBNB.resolvePublickey(rsp);

            const { commandData, serialized } = SecuxBNB.prepareSign(path, { publickey, to, amount });
            rsp = await GetDevice().Exchange(commandData);
            signed = SecuxBNB.resolveTransaction(rsp, serialized);

            assert.exists(signed);
        }).timeout(10000);

        it("can directly call", async () => {
            const { raw_tx } = await GetDevice().sign(path, { to, amount });

            assert.equal(raw_tx, signed);
        }).timeout(10000);

        it('verify raw data of signed transaction', async () => {
            const sendMsg = new types.SendMsg(from, [
                {
                    address: to,
                    coins: [
                        {
                            denom: "BNB",
                            amount
                        }
                    ]
                }
            ]);

            const tx = new Transaction({
                chainId: "Binance-Chain-Tigris",
                accountNumber: account_number,
                sequence,
                baseMsg: sendMsg,
                memo: "",
                source: 1
            });

            const child = root.derivePath(path);
            const expected = tx.sign(child.privateKey.toString("hex")).serialize();

            txCheck(signed, expected, amount);
        });

        if (BROADCAST) {
            it("broadcast transaction", async () => {
                const path = "m/44'/714'/0'/0/0";
                const to = await SecuxBNB.getAddress(GetDevice(), "m/44'/714'/1'/0/0");
                const signed = await SecuxBNB.signTransaction(GetDevice(), path, {
                    to,
                    amount: 1000
                });

                assert.exists(signed);

                const response = await fetch("https://dex.binance.org/api/v1/broadcast", {
                    method: "POST",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "text/plain"
                    },
                    body: signed.raw_tx
                });
                console.log(await response.json());
            }).timeout(60000);
        }
    });
}


function txCheck(actual, expect, amount) {
    const actualTX = decoder.decodeBnbRawTx(actual, "Transfer");
    const expectTX = decoder.decodeBnbRawTx(expect, "Transfer");

    assert.equal(actualTX.msg[0].inputs[0].address, expectTX.msg[0].inputs[0].address, "[from]");
    assert.equal(actualTX.msg[0].inputs[0].coins[0].amount, expectTX.msg[0].inputs[0].coins[0].amount, "[input amount]");
    assert.equal(actualTX.msg[0].outputs[0].address, expectTX.msg[0].outputs[0].address, "[to]");
    assert.equal(actualTX.msg[0].outputs[0].coins[0].amount, amount, "[output amount]");
    assert.equal(actualTX.msg[0].msgType, expectTX.msg[0].msgType, "[message type]");
    assert.equal(actualTX.signatures[0].pub_key, expectTX.signatures[0].pub_key, "[sig pubkey]");
    assert.equal(actualTX.signatures[0].signature, expectTX.signatures[0].signature, "[signature]");
    assert.equal(actualTX.signatures[0].account_number, expectTX.signatures[0].account_number, "[account number]");
}

function RandomNumber(max) {
    const value = (new BigNumber(Math.random())).times(max).integerValue();
    return value.toString();
}
