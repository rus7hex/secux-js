const { mnemonicToSeedSync } = require("bip39");
const { fromSeed } = require("bip32");
const { RippleAPI } = require("ripple-lib");
const { Wallet, BroadcastClient } = require("xrpl");
const BinaryCodec = require("ripple-binary-codec");
const { SecuxXRP } = require("@secux/app-xrp");
const { validate } = require("multicoin-address-validator");
const { assert } = require("chai");
const api = new RippleAPI();


const mnemonic = "neither black arm fun match nominee north lock cave judge window juice humor list verify permit unfold unfair expect muscle human true spoil ancient";
const seed = mnemonicToSeedSync(mnemonic);
const root = fromSeed(seed);


const BROADCAST = false;
export function test(GetDevice) {
    describe('SecuxXRP.getAddress()', () => {
        describe("Classic Address", () => {
            const path = `m/44'/144'/${RandomNumber(20)}'/0/${RandomNumber(20)}`;
            const child = root.derivePath(path);
            const expected = api.deriveAddress(child.publicKey.toString("hex"));

            let address;
            it('query xrp address', async () => {
                const data = SecuxXRP.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxXRP.resolveAddress(rsp);

                assert.equal(address, expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);

                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "XRP");

                assert.equal(valid, true);
                assert.equal(address.startsWith("r"), true);
            });
        });

        describe("X-address", () => {
            it('query xrp address', async () => {
                assert.fail("need a test");
            });
        });
    });

    describe("SecuxXRP.signTransaction()", () => {
        const path_from = `m/44'/144'/0'/0/0`;
        const path_to = `m/44'/144'/${RandomNumber(20)}'/0/${RandomNumber(20)}`;
        const from = api.deriveAddress(root.derivePath(path_from).publicKey.toString("hex"));
        const to = api.deriveAddress(root.derivePath(path_to).publicKey.toString("hex"));
        const amount = Math.ceil(Math.random() * 1e6);

        let payment = {
            TransactionType: "Payment",
            Account: from,
            Destination: to,
            Amount: amount
        };

        let client;
        before(async () => {
            client = new BroadcastClient(["wss://s1.ripple.com"]);
            await client.connect();

            payment = await client.autofill(payment);
        });

        let tx;
        it("can create signed transaction", async () => {
            const data = SecuxXRP.preparePublickey(path_from);
            let rsp = await GetDevice().Exchange(data);
            const publickey = SecuxXRP.resolvePublickey(rsp);

            const { commandData, serialized } = SecuxXRP.prepareSign(path_from, {
                ...payment,
                SigningPubKey: publickey
            });
            rsp = await GetDevice().Exchange(commandData);
            tx = SecuxXRP.resolveTransaction(rsp, serialized);

            assert.exists(tx);
        }).timeout(10000);

        it("can directly sign", async () => {
            const { raw_tx } = await GetDevice().sign(path_from, payment);

            assert.equal(raw_tx, tx);
        }).timeout(10000);

        it("verify raw data of signed transaction", async () => {
            const decoded = BinaryCodec.decode(tx);

            assert.equal(decoded.TransactionType, "Payment", "[TransactionType]");
            assert.equal(decoded.Account, from, "[from]");
            assert.equal(decoded.Destination, to, "[to]");
            assert.equal(decoded.Amount, amount.toString(), "[amount]");
            assert.equal(decoded.Fee, payment.Fee, "[fee]");
            assert.equal(decoded.Sequence, payment.Sequence, "[sequence]");

            const child = root.derivePath(path_from);
            const wallet = new Wallet(child.publicKey.toString("hex"), child.privateKey.toString("hex"));
            if (!wallet.verifyTransaction(tx)) throw Error("invalid signed transaction.");
        }).timeout(10000);

        if (BROADCAST) {
            const path_from = "m/44'/144'/1'/0/0";
            const path_to = "m/44'/144'/0'/0/0";
            const from = api.deriveAddress(root.derivePath(path_from).publicKey.toString("hex"));
            const to = api.deriveAddress(root.derivePath(path_to).publicKey.toString("hex"));

            it("can successfully broadcast transaction", async () => {
                let obj = {
                    TransactionType: "Payment",
                    Account: from,
                    Destination: to,
                    Amount: 1e6
                };
                obj = await client.autofill(obj);

                const { raw_tx } = await GetDevice().sign(path_from, obj);

                const rsp = await client.submit(raw_tx);
                // this api will return transaction not found error
                // const rsp = await client.submitAndWait(raw_tx);

                console.log(rsp);
            }).timeout(60000);
        }
    });
}

function RandomNumber(max) {
    const value = Math.floor(Math.random() * max);
    return value.toString();
}