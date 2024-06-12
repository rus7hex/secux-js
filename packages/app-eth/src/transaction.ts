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


const secp256k1 = require('secp256k1/elliptic');
import { keccak256 } from "js-sha3";
import * as rlp from "rlp";
import { BigNumber } from 'bignumber.js';
import ow from "ow";
import { ow_tx1559 } from './interface';
import { Logger } from "@secux/utility";
export { getBuilder, ETHTransactionBuilder, EIP1559Builder };
const logger = Logger?.child({ id: "ethereum" });


const EIP1559_TransactionType = Buffer.from([0x02]);


function getBuilder(data: any) {
    try {
        ow(data, ow_tx1559);
        return new EIP1559Builder(data);
    } catch (error) {}

    return new ETHTransactionBuilder(data);
}

const __tx = new WeakMap();
class ETHTransactionBuilder {
    static deserialize(serialized: Buffer): ETHTransactionBuilder {
        // legacy transaction
        if (serialized[0] >= 0xc0) {
            const values = rlp.decode(serialized);
            if (!Array.isArray(values)) throw new Error('Invalid serialized tx input. Must be array');
            if (values.length !== 6 && values.length !== 9) {
                throw new Error('Invalid transaction. Only expecting unsigned tx with 6 values (legacy) or 9 values (EIP155).');
            }

            const [nonce, gasPrice, gasLimit, to, value, data, v, r, s] = values;
            const _v = parseInt(Buffer.from(v).toString("hex"), 16);
            let chainId = undefined;
            if (![0, 27, 28].includes(_v)) chainId = v;

            return new ETHTransactionBuilder({
                nonce,
                gasPrice,
                gasLimit,
                to,
                value,
                data,
                chainId
            });
        }

        // typed transaction
        if (serialized[0] <= 0x7f) {
            const values = rlp.decode(serialized.slice(1));
            if (!Array.isArray(values)) throw new Error('Invalid serialized tx input. Must be array');
            if (values.length !== 9 && values.length !== 12) {
                throw new Error('Invalid transaction. Only expecting unsigned tx with 9 or 12 values (EIP1559).');
            }

            const [chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data] = values;

            return new EIP1559Builder({
                chainId,
                nonce,
                maxPriorityFeePerGas,
                maxFeePerGas,
                gasLimit,
                to,
                value,
                data
            });
        }

        throw Error(`Invalid serialized tx input, got "${serialized.toString("hex")}"`);
    }

    constructor(tx: any) {
        const _tx = { ...tx };
        __tx.set(this, _tx);

        if (typeof tx.chainId === "string") {
            let str = tx.chainId.slice(2);
            if (str.length % 2 !== 0) str = `0${str}`;
            _tx.chainId = Buffer.from(str, "hex");
        }
        else if (typeof tx.chainId === "number") {
            let str = tx.chainId.toString(16);
            if (str.length % 2 !== 0) str = `0${str}`;
            _tx.chainId = Buffer.from(str, "hex");
        }

        if (tx.gasPrice) {
            const gasPrice = getValue(tx.gasPrice);
            if (gasPrice.lt(1)) logger?.warn(`Minimal gas price is 1 wei, but got ${gasPrice.toString()} wei.`);
        }

        // According to Ethereum Yellow Paper(https://ethereum.github.io/yellowpaper/paper.pdf)
        // gasLimit = G_transaction + G_txdatanonzero × dataByteLength
        // where:
        //      G_transaction = 21000 gas
        //      G_txdatanonzero = 68 gas
        //      dataByteLength — your data size in bytes
        let estimatedGas = 21000;
        if (tx.data) {
            if (typeof tx.data === "string") {
                estimatedGas += (tx.data.length / 2 - 1) * 68;
            }
            else {
                estimatedGas += tx.data.length * 68;
            }
        }

        // deal with compatibale fields
        const gasLimit = tx.gasLimit || tx.gas;
        _tx.gasLimit = gasLimit;
        if (gasLimit) {
            const _gasLimit = getValue(gasLimit);
            if (_gasLimit.lt(estimatedGas)) logger?.warn(`Minimal gas is ${estimatedGas}, but got ${_gasLimit.toString()}.`);
        }
    }

    /**
     * 
     * @param {boolean} toHash 
     * @returns {Buffer} transaction (keccak256 hashed or not)
     */
    serialize(toHash: boolean = false): Buffer {
        const transaction = [
            ...this.prepare(),
            handleRLPValue(this.tx.chainId ?? 0x00),
            0x00, // zero rlp to 80
            0x00
        ];

        const encoded = rlp.encode(transaction);

        return (toHash) ? Buffer.from(keccak256.update(encoded).digest()) : encoded;
    }

    /**
     * sign transaction
     * @param {string} signature 
     * @returns {Buffer} signed transaction
     */
    withSignature(sig: Buffer): Buffer {
        if (!this.verify(sig)) throw Error("invalid signature");

        sig = this.getSignature(sig);
        const transaction = [
            ...this.prepare(),
            handleRLPValue(sig.slice(64)),
            trimZeroForRLP(sig.slice(0, 32)),
            trimZeroForRLP(sig.slice(32, 64))
        ];

        return rlp.encode(transaction);
    }

    getSignature(sig: Buffer): Buffer {
        const chainId = parseInt(Buffer.from(this.tx.chainId ?? [0]).toString("hex"), 16);
        const offset = (chainId > 0) ? chainId * 2 + 35 : 27;
        let v_hex = (sig[64] + offset).toString(16);
        if (v_hex.length % 2 !== 0) v_hex = `0${v_hex}`;
        const v = Buffer.from(v_hex, "hex");

        return Buffer.concat([
            sig.slice(0, 64),
            v
        ]);
    }

    protected prepare() {
        return [
            handleRLPValue(this.tx.nonce),
            handleRLPValue(this.tx.gasPrice),
            handleRLPValue(this.tx.gasLimit),
            this.tx.to,
            handleRLPValue(this.tx.value),
            this.tx.data ?? '', // empty string rlp to 80
        ];
    }

    protected verify(data: Buffer): boolean {
        const sig = data.slice(0, 64);
        try {
            secp256k1.ecdsaRecover(sig, data.readUint8(64), this.serialize(true));
        } catch (error) {
            return false;
        }

        return true;
    }

    get chainId() {
        if (!this.tx.chainId) return undefined;

        return parseInt(Buffer.from(this.tx.chainId).toString("hex"), 16);
    }

    get tx() { return __tx.get(this); }
}

class EIP1559Builder extends ETHTransactionBuilder {
    constructor(tx: any) {
        super(tx);
        const _tx = __tx.get(this);

        // deal with compatibale fields
        const priorityFee = tx.maxPriorityFeePerGas || tx.priorityFee;
        _tx.maxPriorityFeePerGas = priorityFee;
        if (priorityFee) {
            const _priorityFee = getValue(priorityFee);
            if (_priorityFee.lt(1)) logger?.warn(`[maxPriorityFeePerGas] Minimal priority fee is 1 wei.`);
        }

        // deal with compatibale fields
        const maxFee = tx.maxFeePerGas || tx.gasPrice;
        _tx.maxFeePerGas = maxFee;
        if (maxFee) {
            const _maxFee = getValue(maxFee);
            if (_maxFee.lt(1)) logger?.warn(`[maxFeePerGas] Minimal fee is 1 wei, but got ${_maxFee.toString()} wei.`);
        }
    }

    serialize(toHash: boolean = false): Buffer {
        const transaction = this.prepare();

        const encoded = Buffer.concat([
            EIP1559_TransactionType,
            rlp.encode(transaction)
        ]);

        return (toHash) ? Buffer.from(keccak256.update(encoded).digest()) : encoded;
    }

    withSignature(sig: Buffer): Buffer {
        if (!this.verify(sig)) throw Error("invalid signature");

        const transaction = [
            ...this.prepare(),
            handleRLPValue(sig[64]),
            trimZeroForRLP(sig.slice(0, 32)),
            trimZeroForRLP(sig.slice(32, 64))
        ];
        const encoded = rlp.encode(transaction);

        return Buffer.concat([
            EIP1559_TransactionType,
            encoded
        ]);
    }

    getSignature(sig: Buffer): Buffer {
        return sig;
    }

    protected prepare() {
        return [
            handleRLPValue(this.tx.chainId),
            handleRLPValue(this.tx.nonce),
            handleRLPValue(this.tx.maxPriorityFeePerGas),
            handleRLPValue(this.tx.maxFeePerGas),
            handleRLPValue(this.tx.gasLimit),
            this.tx.to,
            handleRLPValue(this.tx.value),
            this.tx.data ?? '', // empty string rlp to 80
            this.tx.accessList ?? []
        ];
    }
}


function handleRLPValue(input: rlp.Input) {
    if (typeof input === 'string') {
        const value = BigNumber(input);
        if (value.isZero()) return 0;

        return `0x${value.toString(16)}`;
    }

    return input;
}

function trimZeroForRLP(data: Buffer) {
    const hex = data.toString("hex");
    const zeros = (hex.match(/^(00)+/g) ?? [''])[0].length / 2;

    return data.slice(zeros);
}

function getValue(data: number | string | Uint8Array): BigNumber {
    if (typeof data === "number") return new BigNumber(data);

    if (typeof data === "string") {
        if (data.startsWith("0x")) return new BigNumber(data.slice(2), 16);
        else return new BigNumber(data);
    }

    return new BigNumber(Buffer.from(data).toString("hex"), 16);
}