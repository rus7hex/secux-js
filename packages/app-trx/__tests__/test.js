const { mnemonicToSeedSync } = require("bip39");
const { fromSeed } = require("bip32");
const { SecuxTRX } = require("@secux/app-trx");
const TronWeb = require("tronweb");
const { Client } = require("@tronscan/client");
const { validate } = require("multicoin-address-validator");
const { assert } = require("chai");


const mnemonic = "neither black arm fun match nominee north lock cave judge window juice humor list verify permit unfold unfair expect muscle human true spoil ancient";
const seed = mnemonicToSeedSync(mnemonic);
const root = fromSeed(seed);
const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io' });


const BROADCAST = false;
export function test(GetDevice) {
    describe('SecuxTRX.getAddress()', () => {
        const path = `m/44'/195'/${RandomNumber(20)}'/0/${RandomNumber(20)}`;
        const child = root.derivePath(path);
        const expected = TronWeb.address.fromPrivateKey(child.privateKey.toString("hex"));

        let address;
        it('query a Tron address', async () => {
            const data = SecuxTRX.prepareAddress(path);
            const rsp = await GetDevice().Exchange(data);
            address = SecuxTRX.resolveAddress(rsp);

            assert.equal(address, expected);
        });

        it("is valid address", () => {
            const valid = validate(address, "TRX");

            assert.equal(valid, true);
            assert.equal(address.startsWith("T"), true);
        });
    });

    describe("SecuxTRX.signTransaction()", () => {
        describe("TRX transaction", () => {
            const path_from = `m/44'/195'/0'/0/0`;
            const path_to = `m/44'/195'/${RandomNumber(20)}'/0/${RandomNumber(20)}`;
            const from = TronWeb.address.fromPrivateKey(root.derivePath(path_from).privateKey.toString("hex"));
            const to = TronWeb.address.fromPrivateKey(root.derivePath(path_to).privateKey.toString("hex"));
            const amount = Math.floor(Math.random() * 1e5);

            let tx, content;
            it("can create signed transaction", async () => {
                const block = await tronWeb.trx.getConfirmedCurrentBlock();
                content = {
                    from,
                    to,
                    amount,
                    blockID: block.blockID,
                    blockNumber: block.block_header.raw_data.number,
                    timestamp: Date.now()
                };

                const { commandData, rawTx } = SecuxTRX.prepareSign(path_from, content);
                const rsp = await GetDevice().Exchange(commandData);
                tx = SecuxTRX.resolveTransaction(rsp, rawTx);

                assert.exists(tx);
            }).timeout(10000);

            it("can directly sign", async () => {
                delete content.from;
                const { raw_tx } = await GetDevice().sign(path_from, content);

                assert.equal(raw_tx, tx);
            }).timeout(10000);

            it("verify raw data of signed transaction", async () => {
                const api = new Client("https://apilist.tronscan.org");
                const actual = await api.readTransactionNew(tx);

                assert.equal(actual.transaction.contracts[0].contractType, "TransferContract");
                assert.equal(actual.transaction.contracts[0].owner_address, from);
                assert.equal(actual.transaction.contracts[0].to_address, to);
                assert.equal(actual.transaction.contracts[0].amount, amount);
                assert.equal(actual.transaction.signatures[0].address, from);
            }).timeout(10000);
        });

        describe("TRC10 transaction", () => {
            const path_from = `m/44'/195'/0'/0/0`;
            const path_to = `m/44'/195'/${RandomNumber(20)}'/0/${RandomNumber(20)}`;
            const from = TronWeb.address.fromPrivateKey(root.derivePath(path_from).privateKey.toString("hex"));
            const to = TronWeb.address.fromPrivateKey(root.derivePath(path_to).privateKey.toString("hex"));
            const amount = Math.floor(Math.random() * 1e5).toString();
            const token = "1002000";

            let tx, content;
            it("can create signed transaction", async () => {
                const block = await tronWeb.trx.getConfirmedCurrentBlock();
                content = {
                    from,
                    token,
                    to,
                    amount,
                    blockID: block.blockID,
                    blockNumber: block.block_header.raw_data.number,
                    timestamp: Date.now()
                };

                const { commandData, rawTx } = SecuxTRX.prepareSign(path_from, content);
                const rsp = await GetDevice().Exchange(commandData);
                tx = SecuxTRX.resolveTransaction(rsp, rawTx);

                assert.exists(tx);
            }).timeout(10000);

            it("can directly sign", async () => {
                delete content.from;
                const { raw_tx } = await GetDevice().sign(path_from, content);

                assert.equal(raw_tx, tx);
            }).timeout(10000);

            it("verify raw data of signed transaction", async () => {
                const api = new Client("https://apilist.tronscan.org");
                const actual = await api.readTransactionNew(tx);

                assert.equal(actual.transaction.contracts[0].contractType, "TransferAssetContract");
                assert.equal(actual.transaction.contracts[0].owner_address, from);
                assert.equal(actual.transaction.contracts[0].to_address, to);
                assert.equal(actual.transaction.contracts[0].amount, amount);
                assert.equal(actual.transaction.contracts[0].asset_name, token);
                assert.equal(actual.transaction.signatures[0].address, from);
            }).timeout(10000);
        });

        describe("TRC20 transaction", () => {
            const path_from = `m/44'/195'/0'/0/0`;
            const path_to = `m/44'/195'/${RandomNumber(20)}'/0/${RandomNumber(20)}`;
            const from = TronWeb.address.fromPrivateKey(root.derivePath(path_from).privateKey.toString("hex"));
            const to = TronWeb.address.fromPrivateKey(root.derivePath(path_to).privateKey.toString("hex"));
            const amount = Math.floor(Math.random() * 1e5);
            const contract = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
            const tokenId = 1000001;
            const tokenValue = 10;

            let tx, content;
            it("can create signed transaction", async () => {
                const block = await tronWeb.trx.getConfirmedCurrentBlock();
                content = {
                    from,
                    contract,
                    to,
                    amount,
                    tokenId,
                    tokenValue,
                    callValue: 0,
                    blockID: block.blockID,
                    blockNumber: block.block_header.raw_data.number,
                    timestamp: Date.now()
                };

                const { commandData, rawTx } = SecuxTRX.prepareSign(path_from, content);
                const rsp = await GetDevice().Exchange(commandData);
                tx = SecuxTRX.resolveTransaction(rsp, rawTx);

                assert.exists(tx);
            }).timeout(10000);

            it("can directly sign", async () => {
                delete content.from;
                const { raw_tx } = await GetDevice().sign(path_from, content);

                assert.equal(raw_tx, tx);
            }).timeout(10000);

            it("verify raw data of signed transaction", async () => {
                const api = new Client("https://apilist.tronscan.org");
                const actual = await api.readTransactionNew(tx);

                assert.equal(actual.transaction.contracts[0].contractType, "TriggerSmartContract");
                assert.equal(actual.transaction.contracts[0].contract_address, contract);
                assert.equal(actual.transaction.contracts[0].owner_address, from);
                assert.equal(actual.transaction.contracts[0].token_id, tokenId);
                assert.equal(actual.transaction.contracts[0].call_token_value, tokenValue);
                assert.equal(actual.transaction.signatures[0].address, from);
            }).timeout(10000);
        });
    });

    if (BROADCAST) {
        describe("broadcast transaction", () => {
            it("trc20", async () => {
                const path_from = `m/44'/195'/0'/0/0`;
                const path_to = `m/44'/195'/1'/0/0`;
                const to = TronWeb.address.fromPrivateKey(root.derivePath(path_to).privateKey.toString("hex"));
                const amount = 1e6;
                const contract = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
                const block = await tronWeb.trx.getConfirmedCurrentBlock();

                const { raw_tx } = await SecuxTRX.signTransaction(GetDevice(), path_from, {
                    contract,
                    to,
                    amount,
                    blockID: block.blockID,
                    blockNumber: block.block_header.raw_data.number,
                    feeLimit: 40 * 1e6
                });

                await tronWeb.trx.sendHexTransaction(raw_tx);
            }).timeout(60000);
        });
    }
}

function RandomNumber(max) {
    const value = Math.floor(Math.random() * max);
    return value.toString();
}