/*!
Copyright 2022 SecuX Technology Inc
Copyright Chen Wei-En
Copyright Wu Tsung-Yu

Licensed under the Apache License, Version 2.0 (the License);
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an AS IS BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/


import { sha256 } from "hash.js";
import * as varuint from 'varuint-bitcoin';
import { BigNumber } from "bignumber.js";
import { BufferReader, BufferWriter } from "./bufferutils";
import * as Script from "./script";
import { OPCODES } from "./coindef";
import { Logger } from "@secux/utility";
export { Transaction, varSliceSize };
const logger = Logger?.child({ id: "transaction" });


const ZERO = Buffer.from(
    '0000000000000000000000000000000000000000000000000000000000000000',
    'hex',
);
const ONE = Buffer.from(
    '0000000000000000000000000000000000000000000000000000000000000001',
    'hex',
);
const EMPTY = Buffer.alloc(0);

const VALUE_UINT64_MAX = Buffer.from('ffffffffffffffff', 'hex');
const BLANK_OUTPUT = {
    script: EMPTY,
    valueBuffer: VALUE_UINT64_MAX,
    value: 0
};

class Transaction {
    static readonly DEFAULT_SEQUENCE = 0xffffffff;
    static readonly SIGHASH_DEFAULT = 0x00;
    static readonly SIGHASH_ALL = 0x01;
    static readonly SIGHASH_NONE = 0x02;
    static readonly SIGHASH_SINGLE = 0x03;
    static readonly SIGHASH_ANYONECANPAY = 0x80;
    static readonly SIGHASH_OUTPUT_MASK = 0x03;
    static readonly SIGHASH_INPUT_MASK = 0x80;
    static readonly ADVANCED_TRANSACTION_MARKER = 0x00;
    static readonly ADVANCED_TRANSACTION_FLAG = 0x01;


    version: number;
    locktime: number;
    ins: Array<{
        hash: Buffer,
        index: number,
        script: Buffer,
        sequence: number,
        witness: Array<Buffer>
    }> = [];
    outs: Array<{
        script: Buffer,
        value: BigNumber.Value,
        path?: string
    }> = [];


    constructor() {
        this.version = 2;
        this.locktime = 0;
    }

    static fromBuffer(buffer: Buffer) {
        const bufferReader = new BufferReader(buffer);
        const tx = new Transaction();
        tx.version = bufferReader.readInt32();
        const marker = bufferReader.readUInt8();
        const flag = bufferReader.readUInt8();
        let hasWitnesses = false;
        if (
            marker === Transaction.ADVANCED_TRANSACTION_MARKER &&
            flag === Transaction.ADVANCED_TRANSACTION_FLAG
        ) {
            hasWitnesses = true;
        } else {
            bufferReader.offset -= 2;
        }
        const vinLen = bufferReader.readVarInt();
        for (let i = 0; i < vinLen; ++i) {
            tx.ins.push({
                hash: bufferReader.readSlice(32),
                index: bufferReader.readUInt32(),
                script: bufferReader.readVarSlice(),
                sequence: bufferReader.readUInt32(),
                witness: [],
            });
        }
        const voutLen = bufferReader.readVarInt();
        for (let i = 0; i < voutLen; ++i) {
            tx.outs.push({
                value: bufferReader.readUInt64(),
                script: bufferReader.readVarSlice(),
            });
        }
        if (hasWitnesses) {
            for (let i = 0; i < vinLen; ++i) {
                tx.ins[i].witness = bufferReader.readVector();
            }
            // was this pointless?
            if (!tx.hasWitnesses())
                throw new Error('Transaction has superfluous witness data');
        }
        tx.locktime = bufferReader.readUInt32();
        if (bufferReader.offset !== buffer.length) throw new Error('Transaction has unexpected data');

        return tx;
    }

    static dataForSignature(trans: Transaction, inIndex: number, prevOutScript: Buffer, hashType: number): Buffer {
        // https://github.com/bitcoin/bitcoin/blob/master/src/test/sighash_tests.cpp#L29
        if (inIndex >= trans.ins.length) return ONE;
        // ignore OP_CODESEPARATOR
        const ourScript = Script.compile(
            Script.decompile(prevOutScript)!.filter(x => {
                return x !== OPCODES.OP_CODESEPARATOR;
            }),
        )!;
        const txTmp = trans.clone();
        // SIGHASH_NONE: ignore all outputs? (wildcard payee)
        if ((hashType & 0x1f) === Transaction.SIGHASH_NONE) {
            txTmp.outs = [];
            // ignore sequence numbers (except at inIndex)
            txTmp.ins.forEach((input, i) => {
                if (i === inIndex) return;
                input.sequence = 0;
            });
            // SIGHASH_SINGLE: ignore all outputs, except at the same index?
        } else if ((hashType & 0x1f) === Transaction.SIGHASH_SINGLE) {
            // https://github.com/bitcoin/bitcoin/blob/master/src/test/sighash_tests.cpp#L60
            if (inIndex >= trans.outs.length) return ONE;
            // truncate outputs after
            txTmp.outs.length = inIndex + 1;
            // "blank" outputs before
            for (let i = 0; i < inIndex; i++) {
                txTmp.outs[i] = BLANK_OUTPUT;
            }
            // ignore sequence numbers (except at inIndex)
            txTmp.ins.forEach((input, y) => {
                if (y === inIndex) return;
                input.sequence = 0;
            });
        }
        // SIGHASH_ANYONECANPAY: ignore inputs entirely?
        if (hashType & Transaction.SIGHASH_ANYONECANPAY) {
            txTmp.ins = [txTmp.ins[inIndex]];
            txTmp.ins[0].script = ourScript;
            // SIGHASH_ALL: only ignore input scripts
        } else {
            // "blank" others input scripts
            txTmp.ins.forEach(input => {
                input.script = EMPTY;
            });
            txTmp.ins[inIndex].script = ourScript;
        }
        // serialize and hash
        const buffer = Buffer.allocUnsafe(txTmp.byteLength(false) + 4);
        buffer.writeInt32LE(hashType, buffer.length - 4);
        txTmp.toBuffer(buffer, 0, false);

        return buffer;
    }

    static dataForWitnessV0(trans: Transaction, inIndex: number, prevOutScript: Buffer, value: number, hashType: number): Buffer {
        let tbuffer = Buffer.from([]);
        let bufferWriter: any;
        let hashOutputs = ZERO;
        let hashPrevouts = ZERO;
        let hashSequence = ZERO;

        logger?.debug("begin dataForWitnessV0");
        logger?.debug(`hashType: 0x${hashType.toString(16)}`);

        if (!(hashType & Transaction.SIGHASH_ANYONECANPAY)) {
            tbuffer = Buffer.allocUnsafe(36 * trans.ins.length);
            bufferWriter = new BufferWriter(tbuffer, 0);
            trans.ins.forEach(txIn => {
                bufferWriter.writeSlice(txIn.hash);
                bufferWriter.writeUInt32(txIn.index);
            });
            hashPrevouts = hash256(tbuffer);
        }

        if (
            !(hashType & Transaction.SIGHASH_ANYONECANPAY) &&
            (hashType & 0x1f) !== Transaction.SIGHASH_SINGLE &&
            (hashType & 0x1f) !== Transaction.SIGHASH_NONE
        ) {
            tbuffer = Buffer.allocUnsafe(4 * trans.ins.length);
            bufferWriter = new BufferWriter(tbuffer, 0);
            trans.ins.forEach(txIn => {
                bufferWriter.writeUInt32(txIn.sequence);
            });
            hashSequence = hash256(tbuffer);
        }

        if (
            (hashType & 0x1f) !== Transaction.SIGHASH_SINGLE &&
            (hashType & 0x1f) !== Transaction.SIGHASH_NONE
        ) {
            const txOutsSize = trans.outs.reduce((sum, output) => {
                return sum + 8 + varSliceSize(output.script);
            }, 0);
            tbuffer = Buffer.allocUnsafe(txOutsSize);
            bufferWriter = new BufferWriter(tbuffer, 0);
            trans.outs.forEach(out => {
                bufferWriter.writeUInt64(out.value);
                bufferWriter.writeVarSlice(out.script);
            });

            logger?.debug(`outputs: ${tbuffer.toString("hex")}`);
            hashOutputs = hash256(tbuffer);
        }
        else if (
            (hashType & 0x1f) === Transaction.SIGHASH_SINGLE &&
            inIndex < trans.outs.length
        ) {
            const output = trans.outs[inIndex];
            tbuffer = Buffer.allocUnsafe(8 + varSliceSize(output.script));
            bufferWriter = new BufferWriter(tbuffer, 0);
            bufferWriter.writeUInt64(output.value);
            bufferWriter.writeVarSlice(output.script);

            logger?.debug(`single output: ${tbuffer.toString("hex")}`);
            hashOutputs = hash256(tbuffer);
        }


        tbuffer = Buffer.allocUnsafe(156 + varSliceSize(prevOutScript));
        bufferWriter = new BufferWriter(tbuffer, 0);
        const input = trans.ins[inIndex];
        bufferWriter.writeUInt32(trans.version);
        bufferWriter.writeSlice(hashPrevouts);
        bufferWriter.writeSlice(hashSequence);
        bufferWriter.writeSlice(input.hash);
        bufferWriter.writeUInt32(input.index);
        bufferWriter.writeVarSlice(prevOutScript);
        bufferWriter.writeUInt64(value);
        bufferWriter.writeUInt32(input.sequence);
        bufferWriter.writeSlice(hashOutputs);
        bufferWriter.writeUInt32(trans.locktime);
        bufferWriter.writeUInt32(hashType);

        logger?.debug("end dataForWitnessV0");

        return tbuffer;
    }

    static dataForWitnessV1(
        trans: Transaction,
        inIndex: number,
        prevOutScripts: Buffer[],
        values: number[],
        hashType: number,
        leafHash?: Buffer,
        annex?: Buffer,
    ): Buffer {
        // https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message
        if (
            values.length !== trans.ins.length ||
            prevOutScripts.length !== trans.ins.length
        ) {
            throw new Error('Must supply prevout script and value for all inputs');
        }

        const outputType = (hashType === Transaction.SIGHASH_DEFAULT) ? Transaction.SIGHASH_ALL
            : hashType & Transaction.SIGHASH_OUTPUT_MASK;

        const inputType = hashType & Transaction.SIGHASH_INPUT_MASK;

        const isAnyoneCanPay = inputType === Transaction.SIGHASH_ANYONECANPAY;
        const isNone = outputType === Transaction.SIGHASH_NONE;
        const isSingle = outputType === Transaction.SIGHASH_SINGLE;

        let hashPrevouts = EMPTY;
        let hashAmounts = EMPTY;
        let hashScriptPubKeys = EMPTY;
        let hashSequences = EMPTY;
        let hashOutputs = EMPTY;

        logger?.debug("begin dataForWitnessV1");
        logger?.debug(`hashType: 0x${hashType.toString(16)}`);

        if (!isAnyoneCanPay) {
            let buf = Buffer.alloc(36 * trans.ins.length);
            let bufferWriter = new BufferWriter(buf);
            trans.ins.forEach(txIn => {
                bufferWriter.writeSlice(txIn.hash);
                bufferWriter.writeUInt32(txIn.index);
            });
            hashPrevouts = _sha256(buf);

            buf = Buffer.alloc(8 * trans.ins.length);
            bufferWriter = new BufferWriter(buf);
            values.forEach(value => bufferWriter.writeUInt64(value));
            hashAmounts = _sha256(buf);

            buf = Buffer.alloc(prevOutScripts.map(varSliceSize).reduce((a, b) => a + b));
            bufferWriter = new BufferWriter(buf);
            prevOutScripts.forEach(prevOutScript => bufferWriter.writeVarSlice(prevOutScript));
            hashScriptPubKeys = _sha256(buf);

            buf = Buffer.alloc(4 * trans.ins.length);
            bufferWriter = new BufferWriter(buf);
            trans.ins.forEach(txIn => bufferWriter.writeUInt32(txIn.sequence));
            hashSequences = _sha256(buf);
        }

        if (!(isNone || isSingle)) {
            const txOutsSize = trans.outs
                .map(output => 8 + varSliceSize(output.script))
                .reduce((a, b) => a + b);
            const buf = Buffer.alloc(txOutsSize);
            const bufferWriter = new BufferWriter(buf);

            trans.outs.forEach(out => {
                bufferWriter.writeUInt64(out.value);
                bufferWriter.writeVarSlice(out.script);
            });

            logger?.debug(`outputs: ${buf.toString("hex")}`);
            hashOutputs = _sha256(buf);
        } else if (isSingle && inIndex < trans.outs.length) {
            const output = trans.outs[inIndex];

            const buf = Buffer.alloc(8 + varSliceSize(output.script));
            const bufferWriter = new BufferWriter(buf);

            bufferWriter.writeUInt64(output.value);
            bufferWriter.writeVarSlice(output.script);

            logger?.debug(`single output: ${buf.toString("hex")}`);
            hashOutputs = _sha256(buf);
        }

        const spendType = (leafHash ? 2 : 0) + (annex ? 1 : 0);

        // Length calculation from:
        // https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#cite_note-14
        // With extension from:
        // https://github.com/bitcoin/bips/blob/master/bip-0342.mediawiki#signature-validation
        const sigMsgSize =
            174 -
            (isAnyoneCanPay ? 49 : 0) -
            (isNone ? 32 : 0) +
            (annex ? 32 : 0) +
            (leafHash ? 37 : 0);
        const buf = Buffer.alloc(sigMsgSize);
        const sigMsgWriter = new BufferWriter(buf);

        sigMsgWriter.writeUInt8(hashType);
        // Transaction
        sigMsgWriter.writeInt32(trans.version);
        sigMsgWriter.writeUInt32(trans.locktime);
        sigMsgWriter.writeSlice(hashPrevouts);
        sigMsgWriter.writeSlice(hashAmounts);
        sigMsgWriter.writeSlice(hashScriptPubKeys);
        sigMsgWriter.writeSlice(hashSequences);
        if (!(isNone || isSingle)) {
            sigMsgWriter.writeSlice(hashOutputs);
        }
        // Input
        sigMsgWriter.writeUInt8(spendType);
        if (isAnyoneCanPay) {
            const input = trans.ins[inIndex];
            sigMsgWriter.writeSlice(input.hash);
            sigMsgWriter.writeUInt32(input.index);
            sigMsgWriter.writeUInt64(values[inIndex]);
            sigMsgWriter.writeVarSlice(prevOutScripts[inIndex]);
            sigMsgWriter.writeUInt32(input.sequence);
        } else {
            sigMsgWriter.writeUInt32(inIndex);
        }
        if (annex) {
            const buf = Buffer.alloc(varSliceSize(annex));
            const bufferWriter = new BufferWriter(buf);
            bufferWriter.writeVarSlice(annex);
            sigMsgWriter.writeSlice(_sha256(buf));
        }
        // Output
        if (isSingle) {
            sigMsgWriter.writeSlice(hashOutputs);
        }
        // BIP342 extension
        if (leafHash) {
            sigMsgWriter.writeSlice(leafHash);
            sigMsgWriter.writeUInt8(0);
            sigMsgWriter.writeUInt32(0xffffffff);
        }
        
        logger?.debug("end dataForWitnessV1");

        // Extra zero byte because:
        // https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#cite_note-19
        return Buffer.concat([Buffer.from([0x00]), buf]);
    }

    static getHash(trans: Transaction, forWitness?: boolean) {
        // wtxid for coinbase is always 32 bytes of 0x00
        if (forWitness && trans.isCoinbase()) return Buffer.alloc(32, 0);

        return hash256(trans.toBuffer(undefined, undefined, forWitness));
    }

    static getId(trans: Transaction) {
        return this.getHash(trans).reverse().toString("hex");
    }


    addInput(hash: Buffer, index: number, sequence?: number, scriptSig?: Buffer) {
        if (!sequence || sequence === 0) sequence = Transaction.DEFAULT_SEQUENCE;

        this.ins.push({
            hash,
            index,
            script: scriptSig ?? EMPTY,
            sequence: sequence,
            witness: [],
        });
    }

    addOutput(scriptPubKey: Buffer, value: BigNumber.Value, path?: string) {
        this.outs.push({
            script: scriptPubKey,
            value,
            path
        });
    }

    toBuffer(buffer?: Buffer, initialOffset?: number, _ALLOW_WITNESS = false) {
        if (!buffer) buffer = Buffer.allocUnsafe(this.byteLength(_ALLOW_WITNESS));
        const bufferWriter = new BufferWriter(
            buffer,
            initialOffset ?? 0,
        );
        bufferWriter.writeInt32(this.version);
        const hasWitnesses = _ALLOW_WITNESS && this.hasWitnesses();
        if (hasWitnesses) {
            bufferWriter.writeUInt8(Transaction.ADVANCED_TRANSACTION_MARKER);
            bufferWriter.writeUInt8(Transaction.ADVANCED_TRANSACTION_FLAG);
        }
        bufferWriter.writeVarInt(this.ins.length);
        this.ins.forEach(txIn => {
            bufferWriter.writeSlice(txIn.hash);
            bufferWriter.writeUInt32(txIn.index);
            bufferWriter.writeVarSlice(txIn.script);
            bufferWriter.writeUInt32(txIn.sequence);
        });
        bufferWriter.writeVarInt(this.outs.length);
        this.outs.forEach(txOut => {
            if (txOut.value !== undefined) {
                bufferWriter.writeUInt64(txOut.value);
            } else {
                //@ts-ignore
                bufferWriter.writeSlice(txOut.valueBuffer);
            }
            bufferWriter.writeVarSlice(txOut.script);
        });
        if (hasWitnesses) {
            this.ins.forEach(input => {
                bufferWriter.writeVector(input.witness);
            });
        }
        bufferWriter.writeUInt32(this.locktime);
        // avoid slicing unless necessary
        if (initialOffset !== undefined)
            return buffer.slice(initialOffset, bufferWriter.offset);

        return buffer;
    }

    toHex() {
        return this.toBuffer(undefined, undefined, true).toString('hex');
    }

    hasWitnesses() {
        return this.ins.some(x => {
            return x.witness.length !== 0;
        });
    }

    isCoinbase() {
        if (this.ins.length !== 1) return false;

        const hash = this.ins[0].hash;
        for (let i = 0; i < 32; ++i) {
            if (hash[i] !== 0) return false;
        }

        return true;
    }

    clone() {
        const newTx = new Transaction();
        newTx.version = this.version;
        newTx.locktime = this.locktime;
        newTx.ins = this.ins.map(txIn => {
            return {
                hash: txIn.hash,
                index: txIn.index,
                script: txIn.script,
                sequence: txIn.sequence,
                witness: txIn.witness,
            };
        });
        newTx.outs = this.outs.map(txOut => {
            return {
                script: txOut.script,
                value: txOut.value,
            };
        });

        return newTx;
    }

    weight(): number {
        const base = this.byteLength(false);
        const total = this.byteLength(true);
        return base * 3 + total;
    }

    virtualSize(): number {
        return Math.ceil(this.weight() / 4);
    }

    byteLength(_ALLOW_WITNESS = true) {
        const hasWitnesses = _ALLOW_WITNESS && this.hasWitnesses();

        return (
            (hasWitnesses ? 10 : 8) +
            varuint.encodingLength(this.ins.length) +
            varuint.encodingLength(this.outs.length) +
            this.ins.reduce((sum, input) => {
                return sum + 40 + varSliceSize(input.script);
            }, 0) +
            this.outs.reduce((sum, output) => {
                return sum + 8 + varSliceSize(output.script);
            }, 0) +
            (hasWitnesses
                ? this.ins.reduce((sum, input) => {
                    return sum + vectorSize(input.witness);
                }, 0)
                : 0)
        );
    }
}


function _sha256(data: Buffer) {
    return Buffer.from(sha256().update(data).digest());
}

function hash256(data: Buffer) {
    const hash1 = sha256().update(data).digest();
    const hash2 = sha256().update(hash1).digest();

    return Buffer.from(hash2);
}


function varSliceSize(someScript: Buffer) {
    const length = someScript.length;

    return varuint.encodingLength(length) + length;
}

function vectorSize(someVector: Array<Buffer>) {
    const length = someVector.length;

    return (
        varuint.encodingLength(length) +
        someVector.reduce((sum, witness) => {
            return sum + varSliceSize(witness);
        }, 0)
    );
}