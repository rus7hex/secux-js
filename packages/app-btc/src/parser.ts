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


import { Psbt } from "bip174";
import { KeyValue, PsbtGlobal, PsbtInput, PsbtOutput, Transaction, TransactionFromBuffer } from "bip174/src/lib/interfaces";
import { PsbtAttributes } from "bip174/src/lib/parser/index";
import { BigNumber } from "bignumber.js";
import * as convert from "bip174/src/lib/converter";
import { BufferReader } from "./bufferutils";


export class Psbtv2 extends Psbt {
    static fromBuffer<T extends typeof Psbt>(
        this: T,
        buffer: Buffer,
        txFromBuffer: TransactionFromBuffer,
    ): InstanceType<T> {
        const results = psbtFromBuffer(buffer, txFromBuffer);
        const psbt = new this(results.globalMap.unsignedTx) as InstanceType<T>;
        Object.assign(psbt, results);

        return psbt;
    }
}


function psbtFromBuffer(buffer: Buffer, txGetter: TransactionFromBuffer): PsbtAttributes {
    // implements PSBTv2 (https://github.com/bitcoin/bips/blob/master/bip-0370.mediawiki)
    // refer to https://github.com/achow101/hardware-wallet-interface/blob/psbt2/hwilib/psbt.py

    if (buffer.readUInt32BE() !== 0x70736274) {
        throw Error("Format Error: Invalid Magic Number");
    }
    if (buffer.readUInt8(4) !== 0xff) {
        throw Error('Format Error: Magic Number must be followed by 0xff separator');
    }

    const reader = new BufferReader(buffer);
    reader.offset += 5;

    const getKeyValue = () => {
        const key = reader.readVarSlice();
        const value = reader.readVarSlice();

        return { key, value };
    };
    const checkEndOfKeyValPairs = () => {
        if (reader.offset >= buffer.length) throw Error('Format Error: Unexpected End of PSBT');

        const isEnd = buffer.readUInt8(reader.offset) === 0;
        if (isEnd) reader.offset += 1;

        return isEnd;
    };

    const globalMapKeyVals: KeyValue[] = [];
    const globalKeyIndex: { [index: string]: number } = {};
    while (!checkEndOfKeyValPairs()) {
        const keyVal = getKeyValue();
        const hexKey = keyVal.key.toString('hex');
        if (globalKeyIndex[hexKey]) throw Error('Format Error: Keys must be unique for global keymap: key ' + hexKey);

        globalKeyIndex[hexKey] = 1;
        globalMapKeyVals.push(keyVal);
    }

    const unsignedTxMaps = globalMapKeyVals.filter(keyVal => keyVal.key[0] === GlobalTypes.UNSIGNED_TX);
    if (unsignedTxMaps.length !== 1) throw Error('Format Error: Only one UNSIGNED_TX allowed');

    const unsignedTx = txGetter(unsignedTxMaps[0].value);

    // Get input and output counts to loop the respective fields
    const { inputCount, outputCount } = unsignedTx.getInputOutputCounts();
    const inputKeyVals: KeyValue[][] = [];
    const outputKeyVals: KeyValue[][] = [];

    // Get input fields
    for (let index = 0; index < inputCount; index++) {
        const inputKeyIndex: { [index: string]: number } = {};
        const input = [] as KeyValue[];

        while (!checkEndOfKeyValPairs()) {
            const keyVal = getKeyValue();
            const hexKey = keyVal.key.toString('hex');
            if (inputKeyIndex[hexKey]) {
                throw Error(`Format Error: Keys must be unique, got "${hexKey}" from input#${index}`);
            }

            inputKeyIndex[hexKey] = 1;
            input.push(keyVal);
        }
        inputKeyVals.push(input);
    }

    for (let index = 0; index < outputCount; index++) {
        const outputKeyIndex: { [index: string]: number } = {};
        const output = [] as KeyValue[];

        while (!checkEndOfKeyValPairs()) {
            const keyVal = getKeyValue();
            const hexKey = keyVal.key.toString('hex');
            if (outputKeyIndex[hexKey]) {
                throw Error(`Format Error: Keys must be unique, got "${hexKey}" from output#${index}`);
            }

            outputKeyIndex[hexKey] = 1;
            output.push(keyVal);
        }
        outputKeyVals.push(output);
    }

    return psbtFromKeyVals(unsignedTx, {
        globalMapKeyVals,
        inputKeyVals,
        outputKeyVals,
    });
}

interface PsbtFromKeyValsArg {
    globalMapKeyVals: KeyValue[];
    inputKeyVals: KeyValue[][];
    outputKeyVals: KeyValue[][];
}

function psbtFromKeyVals(unsignedTx: Transaction, { globalMapKeyVals, inputKeyVals, outputKeyVals }: PsbtFromKeyValsArg) {
    // That was easy :-)
    const globalMap: PsbtGlobalv2 = {
        unsignedTx,
    };

    let txCount = 0;
    let inputCount;
    let outputCount;
    for (const keyVal of globalMapKeyVals) {
        // If a globalMap item needs pubkey, uncomment
        // const pubkey = convert.globals.checkPubkey(keyVal);

        let reader;
        switch (keyVal.key[0]) {
            case GlobalTypes.UNSIGNED_TX:
                checkKeyBuffer('global', keyVal.key, GlobalTypes.UNSIGNED_TX);
                if (txCount > 0) {
                    throw new Error('Format Error: GlobalMap has multiple UNSIGNED_TX');
                }
                txCount++;
                break;
            case GlobalTypes.GLOBAL_XPUB:
                if (globalMap.globalXpub === undefined) {
                    globalMap.globalXpub = [];
                }
                globalMap.globalXpub.push(convert.globals.globalXpub.decode(keyVal));
                break;
            case GlobalTypes.GLOBAL_TX_VERSION:
                checkKeyBuffer('global', keyVal.key, GlobalTypes.GLOBAL_TX_VERSION);
                if (keyVal.value.length !== 4) throw Error("Value Error: Global transaction version is not 4 bytes");
                globalMap.txVersion = keyVal.value.readUInt32LE();
                break;
            case GlobalTypes.GLOBAL_FALLBACK_LOCKTIME:
                checkKeyBuffer('global', keyVal.key, GlobalTypes.GLOBAL_FALLBACK_LOCKTIME);
                if (keyVal.value.length !== 4) throw Error("Value Error: Global fallback locktime is not 4 bytes");
                globalMap.fallbackLocktime = keyVal.value.readUInt32LE();
                break;
            case GlobalTypes.GLOBAL_INPUT_COUNT:
                checkKeyBuffer('global', keyVal.key, GlobalTypes.GLOBAL_INPUT_COUNT);
                reader = new BufferReader(keyVal.value);
                reader.readVarInt(); // Value length, we can ignore this
                inputCount = reader.readVarInt();
                break;
            case GlobalTypes.GLOBAL_OUTPUT_COUNT:
                checkKeyBuffer('global', keyVal.key, GlobalTypes.GLOBAL_OUTPUT_COUNT);
                reader = new BufferReader(keyVal.value);
                reader.readVarInt(); // Value length, we can ignore this
                outputCount = reader.readVarInt();
                break;
            case GlobalTypes.GLOBAL_TXMODIFIABLE:
                checkKeyBuffer('global', keyVal.key, GlobalTypes.GLOBAL_TXMODIFIABLE);
                if (keyVal.value.length !== 1) throw Error("Value Error: Global tx modifiable flags is not 1 bytes");
                globalMap.txModifiable = (keyVal.value[0] & 1) === 1;
                break;
            case GlobalTypes.GLOBAL_VERSION:
                checkKeyBuffer('global', keyVal.key, GlobalTypes.GLOBAL_VERSION);
                if (keyVal.value.length !== 4) throw Error("Value Error: Global PSBT version is not 4 bytes");
                globalMap.version = keyVal.value.readUInt32LE();
                break;
            default:
                // This will allow inclusion during serialization.
                if (!globalMap.unknownKeyVals) globalMap.unknownKeyVals = [];
                globalMap.unknownKeyVals.push(keyVal);
        }
    }

    // Get input and output counts to loop the respective fields
    inputCount = inputCount ?? inputKeyVals.length;
    outputCount = outputCount ?? outputKeyVals.length;
    const inputs: PsbtInputv2[] = [];
    const outputs: PsbtOutputv2[] = [];

    // Get input fields
    for (let index = 0; index < inputCount; index++) {
        const input: PsbtInputv2 = {
            tapScriptSigs: {},
            tapScripts: {},
            tapBip32Paths: {}
        };
        for (const keyVal of inputKeyVals[index]) {
            convert.inputs.checkPubkey(keyVal);

            switch (keyVal.key[0]) {
                case InputTypes.NON_WITNESS_UTXO:
                    checkKeyBuffer('input', keyVal.key, InputTypes.NON_WITNESS_UTXO);
                    if (input.nonWitnessUtxo !== undefined) {
                        throw Error('Format Error: Input has multiple NON_WITNESS_UTXO');
                    }
                    input.nonWitnessUtxo = convert.inputs.nonWitnessUtxo.decode(keyVal);
                    break;
                case InputTypes.WITNESS_UTXO:
                    checkKeyBuffer('input', keyVal.key, InputTypes.WITNESS_UTXO);
                    if (input.witnessUtxo !== undefined) {
                        throw Error('Format Error: Input has multiple WITNESS_UTXO');
                    }
                    input.witnessUtxo = convert.inputs.witnessUtxo.decode(keyVal);
                    break;
                case InputTypes.PARTIAL_SIG:
                    if (input.partialSig === undefined) input.partialSig = [];
                    input.partialSig.push(convert.inputs.partialSig.decode(keyVal));
                    break;
                case InputTypes.SIGHASH_TYPE:
                    checkKeyBuffer('input', keyVal.key, InputTypes.SIGHASH_TYPE);
                    if (input.sighashType !== undefined) {
                        throw Error('Format Error: Input has multiple SIGHASH_TYPE');
                    }
                    input.sighashType = convert.inputs.sighashType.decode(keyVal);
                    break;
                case InputTypes.REDEEM_SCRIPT:
                    checkKeyBuffer('input', keyVal.key, InputTypes.REDEEM_SCRIPT);
                    if (input.redeemScript !== undefined) {
                        throw Error('Format Error: Input has multiple REDEEM_SCRIPT');
                    }
                    input.redeemScript = convert.inputs.redeemScript.decode(keyVal);
                    break;
                case InputTypes.WITNESS_SCRIPT:
                    checkKeyBuffer('input', keyVal.key, InputTypes.WITNESS_SCRIPT);
                    if (input.witnessScript !== undefined) {
                        throw Error('Format Error: Input has multiple WITNESS_SCRIPT');
                    }
                    input.witnessScript = convert.inputs.witnessScript.decode(keyVal);
                    break;
                case InputTypes.BIP32_DERIVATION:
                    if (input.bip32Derivation === undefined) {
                        input.bip32Derivation = [];
                    }
                    input.bip32Derivation.push(
                        convert.inputs.bip32Derivation.decode(keyVal),
                    );
                    break;
                case InputTypes.FINAL_SCRIPTSIG:
                    checkKeyBuffer('input', keyVal.key, InputTypes.FINAL_SCRIPTSIG);
                    input.finalScriptSig = convert.inputs.finalScriptSig.decode(keyVal);
                    break;
                case InputTypes.FINAL_SCRIPTWITNESS:
                    checkKeyBuffer('input', keyVal.key, InputTypes.FINAL_SCRIPTWITNESS);
                    input.finalScriptWitness = convert.inputs.finalScriptWitness.decode(keyVal);
                    break;
                case InputTypes.POR_COMMITMENT:
                    checkKeyBuffer('input', keyVal.key, InputTypes.POR_COMMITMENT);
                    input.porCommitment = convert.inputs.porCommitment.decode(keyVal);
                    break;
                case InputTypes.PREVIOUS_TXID:
                    checkKeyBuffer('input', keyVal.key, InputTypes.PREVIOUS_TXID);
                    if (keyVal.value.length !== 32) throw Error("Value Error: Previous txid is not 32 bytes");
                    input.prevTXID = keyVal.value.toString("hex");
                    break;
                case InputTypes.OUTPUT_INDEX:
                    checkKeyBuffer('input', keyVal.key, InputTypes.OUTPUT_INDEX);
                    if (keyVal.value.length !== 4) throw Error("Value Error: Previous output index is not 4 bytes");
                    input.prevOutputIndex = keyVal.value[0];
                    break;
                case InputTypes.TAP_KEY_SIG:
                    checkKeyBuffer('input', keyVal.key, InputTypes.TAP_KEY_SIG);
                    if (keyVal.value.length < 64) throw Error("Value Error: Input Taproot key path signature is shorter than 64 bytes");
                    if (keyVal.value.length > 65) throw Error("Value Error: Input Taproot key path signature is longer than 65 bytes");
                    input.tapKeySig = keyVal.value;
                    break;
                case InputTypes.TAP_SCRIPT_SIG:
                    checkKeyBuffer('input', keyVal.key, InputTypes.TAP_SCRIPT_SIG);
                    if (keyVal.key.length !== 65) throw Error("Format Error: Input Taproot script signature key is not 65 bytes");
                    if (keyVal.value.length < 64) throw Error("Value Error: Input Taproot script path signature is shorter than 64 bytes");
                    if (keyVal.value.length > 65) throw Error("Value Error: Input Taproot script path signature is longer than 65 bytes");
                    const scriptkey = keyVal.key.slice(1).toString("hex");
                    input.tapScriptSigs[scriptkey] = keyVal.value;
                    break;
                case InputTypes.TAP_LEAF_SCRIPT:
                    checkKeyBuffer('input', keyVal.key, InputTypes.TAP_LEAF_SCRIPT);
                    if (keyVal.key.length < 34) throw Error("Format Error: Input Taproot leaf script key is not at least 34 bytes");
                    if (keyVal.key.length % 32 !== 2) throw Error("Format Error: Input Taproot leaf script key's control block is not valid");
                    if (keyVal.value.length === 0) throw Error("Value Error: Intput Taproot leaf script cannot be empty");
                    const script = keyVal.value.slice(-1).toString("hex");
                    if (!input.tapScripts[script]) input.tapScripts[script] = new Set();
                    input.tapScripts[script].add(keyVal.key.slice(1).toString("hex"));
                    break;
                case InputTypes.TAP_BIP32_DERIVATION:
                    checkKeyBuffer('input', keyVal.key, InputTypes.TAP_BIP32_DERIVATION);
                    if (keyVal.key.length !== 33) throw Error("Format Error: Input Taproot BIP 32 keypath key is not 33 bytes");
                    const xonly = keyVal.key.slice(1).toString("hex");
                    const reader = new BufferReader(keyVal.value);
                    const num_hashs = reader.readVarInt();
                    const leaf_hashes = new Set<string>();
                    for (let i = 0; i < num_hashs; i++) leaf_hashes.add(reader.readSlice(32).toString("hex"));
                    input.tapBip32Paths[xonly] = {
                        leafHashs: leaf_hashes,
                        Bip32Derivation: keyVal.value.slice(reader.offset)
                    };
                    break;
                case InputTypes.TAP_INTERNAL_KEY:
                    checkKeyBuffer('input', keyVal.key, InputTypes.TAP_INTERNAL_KEY);
                    if (keyVal.value.length !== 32) throw Error("Value Error: Input Taproot internal key is not 32 bytes");
                    input.tapInternalKey = keyVal.value;
                    break;
                case InputTypes.TAP_MERKLE_ROOT:
                    checkKeyBuffer('input', keyVal.key, InputTypes.TAP_MERKLE_ROOT);
                    if (keyVal.value.length !== 32) throw Error("Value Error: Input Taproot merkle root is not 32 bytes");
                    input.tapMarkleRoot = keyVal.value.toString("hex");
                    break;
                default:
                    // This will allow inclusion during serialization.
                    if (!input.unknownKeyVals) input.unknownKeyVals = [];
                    input.unknownKeyVals.push(keyVal);
            }
        }
        inputs.push(input);
    }

    for (let index = 0; index < outputCount; index++) {
        const output: PsbtOutputv2 = {
            tapBip32Paths: {}
        };
        for (const keyVal of outputKeyVals[index]) {
            convert.outputs.checkPubkey(keyVal);

            let reader;
            switch (keyVal.key[0]) {
                case OutputTypes.REDEEM_SCRIPT:
                    checkKeyBuffer('output', keyVal.key, OutputTypes.REDEEM_SCRIPT);
                    if (output.redeemScript !== undefined) {
                        throw Error('Format Error: Output has multiple REDEEM_SCRIPT');
                    }
                    output.redeemScript = convert.outputs.redeemScript.decode(keyVal);
                    break;
                case OutputTypes.WITNESS_SCRIPT:
                    checkKeyBuffer('output', keyVal.key, OutputTypes.WITNESS_SCRIPT);
                    if (output.witnessScript !== undefined) {
                        throw Error('Format Error: Output has multiple WITNESS_SCRIPT');
                    }
                    output.witnessScript = convert.outputs.witnessScript.decode(keyVal);
                    break;
                case OutputTypes.BIP32_DERIVATION:
                    if (output.bip32Derivation === undefined) output.bip32Derivation = [];
                    output.bip32Derivation.push(
                        convert.outputs.bip32Derivation.decode(keyVal)
                    );
                    break;
                case OutputTypes.AMOUNT:
                    checkKeyBuffer('output', keyVal.key, OutputTypes.AMOUNT);
                    if (keyVal.value.length !== 8) throw Error("Value Error: Output amount is not 8 bytes");
                    reader = new BufferReader(keyVal.value);
                    output.amount = reader.readUInt64();
                    break;
                case OutputTypes.SCRIPT:
                    checkKeyBuffer('output', keyVal.key, OutputTypes.SCRIPT);
                    output.script = keyVal.value;
                    break;
                case OutputTypes.TAP_INTERNAL_KEY:
                    checkKeyBuffer('output', keyVal.key, OutputTypes.TAP_INTERNAL_KEY);
                    if (keyVal.value.length !== 32) throw Error("Value Error: Output Taproot internal key is not 32 bytes");
                    output.tapInternalKey = keyVal.value;
                    break;
                case OutputTypes.TAP_TREE:
                    checkKeyBuffer('output', keyVal.key, OutputTypes.TAP_TREE);
                    output.tapTree = keyVal.value;
                    break;
                case OutputTypes.TAP_BIP32_DERIVATION:
                    checkKeyBuffer('output', keyVal.key, OutputTypes.TAP_BIP32_DERIVATION);
                    if (keyVal.key.length !== 33) throw Error("Output Taproot BIP 32 keypath key is not 33 bytes");
                    const xonly = keyVal.key.slice(1).toString("hex");
                    const leafHashs = new Set<string>();
                    reader = new BufferReader(keyVal.value);
                    const num_hashs = reader.readVarInt();
                    for (let i = 0; i < num_hashs; i++) leafHashs.add(reader.readSlice(32).toString("hex"));
                    output.tapBip32Paths[xonly] = { leafHashs, Bip32Derivation: keyVal.value.slice(reader.offset) };
                    break;
                default:
                    if (!output.unknownKeyVals) output.unknownKeyVals = [];
                    output.unknownKeyVals.push(keyVal);
            }
        }
        outputs.push(output);
    }

    return { globalMap, inputs, outputs };
}


function checkKeyBuffer(type: string, keyBuf: Buffer, keyNum: number): void {
    if (!keyBuf.equals(Buffer.from([keyNum]))) {
        throw Error(`Format Error: Invalid ${type} key: ${keyBuf.toString('hex')}`);
    }
}

enum GlobalTypes {
    UNSIGNED_TX = 0x00,
    GLOBAL_XPUB = 0x01,
    GLOBAL_TX_VERSION = 0x02,
    GLOBAL_FALLBACK_LOCKTIME = 0x03,
    GLOBAL_INPUT_COUNT = 0x04,
    GLOBAL_OUTPUT_COUNT = 0x05,
    GLOBAL_TXMODIFIABLE = 0x06,
    GLOBAL_VERSION = 0xFB
}

enum InputTypes {
    NON_WITNESS_UTXO = 0x00,
    WITNESS_UTXO = 0x01,
    PARTIAL_SIG = 0x02,
    SIGHASH_TYPE = 0x03,
    REDEEM_SCRIPT = 0x04,
    WITNESS_SCRIPT = 0x05,
    BIP32_DERIVATION = 0x06,
    FINAL_SCRIPTSIG = 0x07,
    FINAL_SCRIPTWITNESS = 0x08,
    POR_COMMITMENT = 0x09,
    PREVIOUS_TXID = 0x0e,
    OUTPUT_INDEX = 0x0f,
    SEQUENCE = 0x10,
    REQUIRED_TIME_LOCKTIME = 0x11,
    REQUIRED_HEIGHT_LOCKTIME = 0x12,
    TAP_KEY_SIG = 0x13,
    TAP_SCRIPT_SIG = 0x14,
    TAP_LEAF_SCRIPT = 0x15,
    TAP_BIP32_DERIVATION = 0x16,
    TAP_INTERNAL_KEY = 0x17,
    TAP_MERKLE_ROOT = 0x18
}

enum OutputTypes {
    REDEEM_SCRIPT = 0x00,
    WITNESS_SCRIPT = 0x01,
    BIP32_DERIVATION = 0x02,
    AMOUNT = 0x03,
    SCRIPT = 0x04,
    TAP_INTERNAL_KEY = 0x05,
    TAP_TREE = 0x06,
    TAP_BIP32_DERIVATION = 0x07
}

export interface PsbtGlobalv2 extends PsbtGlobal {
    txVersion?: number;
    fallbackLocktime?: number;
    txModifiable?: boolean;
    version?: number;
}

export interface PsbtInputv2 extends PsbtInput {
    prevTXID?: string;
    prevOutputIndex?: number;
    tapKeySig?: Buffer;
    tapScriptSigs: { [scriptkey: string]: Buffer };
    tapScripts: { [script: string]: Set<string> };
    tapBip32Paths: { [xonly: string]: { leafHashs: Set<string>, Bip32Derivation: Buffer } };
    tapInternalKey?: Buffer;
    tapMarkleRoot?: string;
}

export interface PsbtOutputv2 extends PsbtOutput {
    amount?: BigNumber;
    script?: Buffer;
    tapInternalKey?: Buffer;
    tapTree?: Buffer;
    tapBip32Paths: { [xonly: string]: { leafHashs: Set<string>, Bip32Derivation: Buffer } };
}