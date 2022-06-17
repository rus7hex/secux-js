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
import { Transaction, varSliceSize } from "./transaction";
import { BufferWriter } from "./bufferutils";
export { TransactionGRS };


const ZERO = Buffer.from(
    '0000000000000000000000000000000000000000000000000000000000000000',
    'hex',
);


class TransactionGRS extends Transaction {
    static dataForWitnessV0(trans: Transaction, inIndex: number, prevOutScript: Buffer, value: number, hashType: number): Buffer {
        let tbuffer = Buffer.from([]);
        let bufferWriter: any;
        let hashOutputs = ZERO;
        let hashPrevouts = ZERO;
        let hashSequence = ZERO;

        if (!(hashType & Transaction.SIGHASH_ANYONECANPAY)) {
            tbuffer = Buffer.allocUnsafe(36 * trans.ins.length);
            bufferWriter = new BufferWriter(tbuffer, 0);
            trans.ins.forEach(txIn => {
                bufferWriter.writeSlice(txIn.hash);
                bufferWriter.writeUInt32(txIn.index);
            });
            hashPrevouts = Buffer.from(sha256().update(tbuffer).digest());
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
            hashSequence = Buffer.from(sha256().update(tbuffer).digest());
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
            hashOutputs = Buffer.from(sha256().update(tbuffer).digest());
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
            hashOutputs = Buffer.from(sha256().update(tbuffer).digest());
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

        return tbuffer;
    }

    static getHash(trans: Transaction, forWitness?: boolean) {
        // wtxid for coinbase is always 32 bytes of 0x00
        if (forWitness && trans.isCoinbase()) return Buffer.alloc(32, 0);

        const data = trans.toBuffer(undefined, undefined, forWitness);
        
        return Buffer.from(sha256().update(data).digest());
    }
}
