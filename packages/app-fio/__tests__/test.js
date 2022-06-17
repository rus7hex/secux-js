const { SecuxFIO } = require("@secux/app-fio");
const { assert } = require("chai");
const { mnemonicToSeedSync } = require("bip39");
const { fromSeed } = require("bip32");
const { BigNumber } = require('bignumber.js');
const { Ecc } = require("@fioprotocol/fiojs");


const mnemonic = "neither black arm fun match nominee north lock cave judge window juice humor list verify permit unfold unfair expect muscle human true spoil ancient";
const seed = mnemonicToSeedSync(mnemonic);
const root = fromSeed(seed);
const url = "https://fiotestnet.blockpane.com/v1/";
SecuxFIO.setApiUrl(url);


export function test(GetDevice) {
    describe('SecuxFIO.getAddress()', () => {
        const path = `m/44'/235'/${RandomNumber(20)}'/0/${RandomNumber(20)}`;
        const child = root.derivePath(path);
        const expected = new Ecc.PublicKey.fromBuffer(child.publicKey).toString();

        let address;
        it('query a FIO address', async () => {
            const data = SecuxFIO.prepareAddress(path);
            const rsp = await GetDevice().Exchange(data);
            address = SecuxFIO.resolveAddress(rsp);

            console.log(SecuxFIO.accountName(address));

            assert.equal(address, expected);
        });

        it("can directly call", async () => {
            const addr = await GetDevice().getAddress(path);

            assert.equal(addr, address);
        });

        it("is valid address", () => {
            assert.equal(address.startsWith("FIO"), true);
        });
    });

    describe('SecuxFIO.signTransaction()', async () => {
        const path = `m/44'/235'/${RandomNumber(20)}'/0/${RandomNumber(20)}`;
        const recvKey = root.derivePath(`m/44'/235'/${RandomNumber(20)}'/0/${RandomNumber(20)}`).publicKey;
        const payeeFioPublicKey = new Ecc.PublicKey.fromBuffer(recvKey).toString();
        const amount = 1e9;
        const maxFee = 800 * 1e9;

        let signed;
        it('can sign transaction', async () => {
            const data = SecuxFIO.prepareAddress(path);
            let rsp = await GetDevice().Exchange(data);
            const sender = SecuxFIO.resolveAddress(rsp);

            const { commandData, serialized } = await SecuxFIO.prepareSign(path, sender,
                "transferTokens",
                {
                    payeeFioPublicKey,
                    amount,
                    maxFee,
                }
            );
            rsp = await GetDevice().Exchange(commandData);
            signed = SecuxFIO.resolveTransaction(rsp, serialized);

            assert.exists(signed);
        }).timeout(10000);

        it("can directly call", async () => {
            const obj = await GetDevice().sign(path,
                "transferTokens",
                {
                    payeeFioPublicKey,
                    amount,
                    maxFee,
                }
            );

            assert.exists(obj);
        }).timeout(10000);
    });

    describe.skip('broadcast', async () => {
        const path = `m/44'/235'/0'/0/0`;
        const recvKey = root.derivePath(`m/44'/235'/1'/0/0`).publicKey;
        const payeeFioPublicKey = new Ecc.PublicKey.fromBuffer(recvKey).toString();
        const amount = 1e9;
        const maxFee = 800 * 1e9;

        it('can sign transaction', async () => {
            const obj = await GetDevice().sign(path,
                "transferTokens",
                {
                    payeeFioPublicKey,
                    amount,
                    maxFee,
                }
            );

            const rsp = await fetch(`${url}chain/push_transaction`, {
                method: "POST",
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(obj)
            });

            console.log(rsp);
        }).timeout(10000);
    });
}

function RandomNumber(max) {
    const value = (new BigNumber(Math.random())).times(max).integerValue();
    return value.toString();
}
