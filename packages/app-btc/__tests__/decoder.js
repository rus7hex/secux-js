const { Transaction, script } = require("bitcoinjs-lib");
const { assert } = require("chai");


export function txCheck(actualTX, expectTX, inputs, outputs) {
    const act = decode(actualTX);
    const exp = decode(expectTX);

    inputs.map((input, i) => {
        const actual = act.ins[i];
        const expected = exp.ins[i];

        assert.equal(Buffer.from(actual.hash, "hex").reverse().toString("hex"), input.hash, `[hash #${i}]`);
        assert.equal(actual.index, input.vout, `[index #${i}]`);
        assert.equal(actual.sequence, expected.sequence, `[sequence #${i}]`);

        if (actual.type === "Segwit") {
            assert.equal(actual.witness.publicKey, expected.witness.publicKey, `[witness pubkey #${i}]`);
            assert.equal(actual.witness.signature, expected.witness.signature, `[witness sig #${i}]`);
        }
        else {
            assert.equal(actual.script.publicKey, expected.script.publicKey, `[script pubkey #${i}]`);
            assert.equal(actual.script.signature, expected.script.signature, `[script sig #${i}]`);
        }
    });

    outputs.map((output, i) => {
        const actual = act.outs[i];
        const expected = exp.outs[i];

        assert.equal(actual.script, expected.script, `[output script #${i}]`);
        assert.equal(actual.value, output.satoshis, `[output value #${i}]`);
    });
}

export function decode(hex) {
    const tx = Transaction.fromHex(hex);

    tx.ins.forEach(input => {
        if (input.witness.length > 0) {
            input.type = 'Segwit'
            input.witness = decodeWitness(input.witness)
            input.script = {
                hex: input.script.toString('hex')
            }
        } else {
            let decodedScript = script.toASM(input.script).split(" ")
            input.type = 'P2PKH'
            input.script = {
                signature: decodedScript[0],
                publicKey: decodedScript[1]
            }
        }
        input.hash = input.hash.toString('hex')
    })

    tx.outs.forEach(output => {
        output.script = script.toASM(output.script);
        output.scriptBuffer = (output.script instanceof Buffer) ? script : script.fromASM(output.script);
    })

    tx.totalValue = sumOutputValue(tx);

    return tx;
}

export function decodeWitness(witness) {
    const { signature: sigBuf, hashType } = script.signature.decode(witness[0])
    const signature = sigBuf.toString('hex')
    const publicKey = witness[1].toString('hex')
    return { signature, publicKey, hashType }
}

function sumOutputValue(tx) {
    let totalValue = 0;
    if (tx && tx.outs && tx.outs.length > 0) {
        totalValue = tx.outs.map(out => out.value).reduce((a, b) => a + b);
    }
    return totalValue
}