const { SecuxXLM } = require("@secux/app-xlm");
const { assert } = require("chai");
const { mnemonicToSeedSync } = require("bip39");
const { derivePath } = require("ed25519-hd-key");
const StellarSdk = require("stellar-sdk");
const { validate } = require("multicoin-address-validator");


const mnemonic = "neither black arm fun match nominee north lock cave judge window juice humor list verify permit unfold unfair expect muscle human true spoil ancient";
const seed = mnemonicToSeedSync(mnemonic);


export function test(GetDevice) {
    describe('SecuxXLM.getAddress()', () => {
        const path = `m/44'/148'/${RandomNumber(20)}'`;
        const { key } = derivePath(path, seed.toString("hex"));
        const expected = StellarSdk.Keypair.fromRawEd25519Seed(key).publicKey();

        let address;
        it('query a XLM address', async () => {
            const data = SecuxXLM.prepareAddress(path);
            const rsp = await GetDevice().Exchange(data);
            address = SecuxXLM.resolveAddress(rsp);

            assert.equal(address, expected);
        });

        it("can directly call", async () => {
            const addr = await GetDevice().getAddress(path);
            assert.equal(addr, address);
        });

        it("is valid address", () => {
            const valid = validate(address, "XLM");
            assert.equal(valid, true);

            assert.equal(address.startsWith("G"), true);
        });
    });

    describe("SecuxXLM.signTransaction()", () => {
        const path_from = `m/44'/148'/0'`;
        const path_to = `m/44'/148'/${RandomNumber(20)}'`;
        const key_from = derivePath(path_from, seed.toString("hex")).key;
        const key_to = derivePath(path_to, seed.toString("hex")).key;
        const from = StellarSdk.Keypair.fromRawEd25519Seed(key_from).publicKey();
        const to = StellarSdk.Keypair.fromRawEd25519Seed(key_to).publicKey();
        const amount = (Math.random() * 1e3).toFixed(7);

        const server = new StellarSdk.Server('https://horizon.stellar.org');

        let sequence, fee;
        it("fetch data from stellar api", async () => {
            const id = await server.accounts().accountId(from).call();
            sequence = id.sequence;
            fee = (await server.fetchBaseFee()).toString();
        }).timeout(10000);

        let signed
        it("can create and sign transaction", async () => {
            const { commandData, serialized } = SecuxXLM.prepareSign(path_from, {
                from,
                to,
                amount,
                sequence,
                fee
            })
            const rsp = await GetDevice().Exchange(commandData);
            signed = SecuxXLM.resolveTransaction(rsp, serialized);

            assert.exists(signed);
        }).timeout(10000);

        it("can directly sign", async () => {
            const { raw_tx } = await GetDevice().sign(path_from, {
                to,
                amount,
                sequence,
                fee
            });

            assert.equal(raw_tx, signed);
        }).timeout(10000);

        it("verify raw data of signed transaction", async () => {
            const tx = StellarSdk.TransactionBuilder.fromXDR(signed, StellarSdk.Networks.PUBLIC);
            assert.equal(tx.source, from, "[from]");
            assert.equal(tx.operations[0].destination, to, "[to]");
            assert.equal(tx.operations[0].amount, amount, "[amount]");
            assert.equal(tx.sequence, Number(sequence) + 1, "[sequence]");
            assert.equal(tx.fee, fee, "[fee]");
            assert.equal(tx.networkPassphrase, StellarSdk.Networks.PUBLIC, "[network]");
            

            const account = await server.loadAccount(from);
            const builder = new StellarSdk.TransactionBuilder(account, {
                fee,
                networkPassphrase: StellarSdk.Networks.PUBLIC
            })
                .addOperation(StellarSdk.Operation.payment({
                    destination: to,
                    asset: StellarSdk.Asset.native(),
                    amount
                }))
                .setTimeout(StellarSdk.TimeoutInfinite)
                .build();

            builder.sign(StellarSdk.Keypair.fromRawEd25519Seed(key_from));
            const expected = builder.toEnvelope().toXDR("base64");

            assert.equal(tx.signatures[0].signature().toString("hex"), builder.signatures[0].signature().toString("hex"), "[signature]");
            assert.equal(signed, expected, "[transaction]");
        });
    });
}

function RandomNumber(max) {
    const value = Math.floor(Math.random() * max);
    return value.toString();
}