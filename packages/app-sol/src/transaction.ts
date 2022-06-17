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


import * as nacl from "tweetnacl";
import { Base58 } from "@secux/utility/lib/bs58";
import { Base58String, HexString } from "./interface";
import { instructionLayout, signDataLayout } from "./layout";


const PACKET_DATA_SIZE = 1280 - 40 - 8;
const PUBLICKEY_LENGTH = 32;

export type Instruction = {
    programId: HexString,
    accounts: Array<{ publickey: HexString, isSigner: boolean, isWritable: boolean }>,
    data: Buffer
};

export class Transaction {
    #recentBlockhash: Base58String;
    #numRequiredSignatures = 0;
    #numReadonlySignedAccounts = 0;
    #numReadonlyUnsignedAccounts = 0;
    #signedKeys: Array<HexString> = [];
    #readonlySignedKeys: Array<HexString> = [];
    #unsignedKeys: Array<HexString> = [];
    #readonlyUnsignedKeys: Array<HexString> = [];
    #instructions: Array<Instruction> = [];
    #sigMap: { [publickey: HexString]: Buffer } = {};
    #cache?: Buffer;

    constructor(blockHash: Base58String) {
        this.#recentBlockhash = blockHash;
    }

    static from(data: Buffer): Transaction {
        let byteArray = [...data];
        const obj = new Transaction('');

        obj.#numRequiredSignatures = byteArray.shift()!;
        obj.#numReadonlySignedAccounts = byteArray.shift()!;
        obj.#numReadonlyUnsignedAccounts = byteArray.shift()!;

        const addKey = (src: Array<HexString>, size: number) => {
            for (let i = 0; i < size; i++) {
                const key = byteArray.splice(0, PUBLICKEY_LENGTH);
                src.push(Buffer.from(key).toString("hex"));
            }
        };
        const accountSize = decodeLength(byteArray);
        addKey(obj.#signedKeys, obj.#numRequiredSignatures - obj.#numReadonlySignedAccounts);
        addKey(obj.#readonlySignedKeys, obj.#numReadonlySignedAccounts);
        addKey(obj.#unsignedKeys, obj.#numReadonlyUnsignedAccounts);
        addKey(obj.#readonlyUnsignedKeys, accountSize - obj.#numRequiredSignatures - obj.#numReadonlyUnsignedAccounts);

        obj.#recentBlockhash = Base58.encode(byteArray.splice(0, PUBLICKEY_LENGTH));

        const accountKeys = [
            ...obj.#signedKeys,
            ...obj.#readonlySignedKeys,
            ...obj.#unsignedKeys,
            ...obj.#readonlyUnsignedKeys
        ];
        const insSize = decodeLength(byteArray);
        for (let i = 0; i < insSize; i++) {
            const programIdIndex = byteArray.shift()!;
            const programId = accountKeys[programIdIndex];

            const accountsLen = decodeLength(byteArray);
            const accountIndices = byteArray.splice(0, accountsLen);
            const accounts = accountIndices.map(idx => ({
                publickey: accountKeys[idx],
                isSigner: idx < obj.#numRequiredSignatures,
                isWritable:
                    idx < obj.#numReadonlySignedAccounts - obj.#numReadonlySignedAccounts ||
                    (idx >= obj.#numRequiredSignatures && idx < accountKeys.length - obj.#numReadonlyUnsignedAccounts)
            }));

            const dataLen = decodeLength(byteArray);
            const data = Buffer.from(byteArray.splice(0, dataLen));

            obj.#instructions.push({
                programId,
                accounts,
                data
            });
        }

        obj.#cache = Buffer.from([...data]);

        return obj;
    }

    addInstruction(ins: Instruction) {
        this.#instructions.push(ins);

        for (const account of ins.accounts) {
            const pk = account.publickey;

            if (account.isSigner) {
                if (account.isWritable) {
                    this.#signedKeys.push(pk);
                }
                else
                    this.#readonlySignedKeys.push(pk);
            }
            else {
                if (!account.isWritable)
                    this.#readonlyUnsignedKeys.push(pk);
                else
                    this.#unsignedKeys.push(pk);
            }

            this.#readonlyUnsignedKeys.push(ins.programId);
        }
    }

    serialize(feePayer?: HexString): Buffer {
        const { accountKeys, instructions } = this.#makeIndexed(feePayer);

        const signData = Buffer.allocUnsafe(PACKET_DATA_SIZE);
        let offset = 0;

        const tx = {
            numRequiredSignatures: Buffer.from([this.#numRequiredSignatures]),
            numReadonlySignedAccounts: Buffer.from([this.#numReadonlySignedAccounts]),
            numReadonlyUnsignedAccounts: Buffer.from([this.#numReadonlyUnsignedAccounts]),
            keyCount: encodeLength(accountKeys.length),
            keys: accountKeys.map(x => Buffer.from(x, "hex")),
            recentBlockhash: Base58.decode(this.#recentBlockhash)
        };
        let layout = signDataLayout(tx);
        offset += layout.encode(tx, signData);

        const headSize = offset;
        offset += encodeLength(instructions.length).copy(signData, offset);
        for (const ins of instructions) {
            layout = instructionLayout(ins);
            offset += layout.encode(ins, signData, offset);

            if (offset - headSize > PACKET_DATA_SIZE) throw Error("Exceed the maximum over-the-wire size");
        }

        this.#cache = signData.slice(0, offset);

        return this.#cache;
    }

    addSignature(publickey: HexString, signature: Buffer) {
        if (!this.#cache) throw Error("serialization needed");

        if (signature.length !== 64) throw Error(`invalid signature length, got ${signature.toString("hex")}`);

        if (!this.#signedKeys.find(x => x === publickey))
            throw Error(`invalid account for siging, got ${Base58.encode(Buffer.from(publickey, "hex"))}`);


        this.#sigMap[publickey] = signature;
    }

    finalize(): Buffer {
        const sigCount = encodeLength(this.#signedKeys.length);
        const size = sigCount.length + this.#signedKeys.length * 64 + this.#cache!.length;
        if (size > PACKET_DATA_SIZE) throw Error(`transaction too large (maximum: ${PACKET_DATA_SIZE}), got ${size}`);
        const wire = Buffer.alloc(size);

        let offset = sigCount.copy(wire);
        for (const key of this.#signedKeys) {
            const publickey = Buffer.from(key, "hex");
            const sig = this.#sigMap[key];

            if (!nacl.sign.detached.verify(this.#cache!, sig, publickey))
                throw Error(`invalid signature, got ${sig.toString("hex")} for ${key}`);

            sig.copy(wire, offset);
            offset += 64;
        }

        this.#cache!.copy(wire, offset);

        return wire;
    }

    get Signers() {
        if (!this.#cache) throw Error("serialization needed");

        return [...this.#signedKeys];
    }

    #makeIndexed(feePayer?: HexString) {
        if (this.#instructions.length === 0) throw Error("No instructions provided");

        const set = new Set<string>();
        if (feePayer) set.add(feePayer);

        this.#signedKeys.forEach(x => set.add(x));
        this.#signedKeys = [...set];

        this.#readonlySignedKeys.forEach(x => set.add(x));
        this.#readonlySignedKeys = [...set].slice(this.#signedKeys.length);

        this.#numRequiredSignatures = set.size;
        this.#numReadonlySignedAccounts = this.#readonlySignedKeys.length;

        this.#unsignedKeys.forEach(x => set.add(x));
        this.#unsignedKeys = [...set].slice(this.#numRequiredSignatures);

        let cur = set.size;
        this.#readonlyUnsignedKeys.forEach(x => set.add(x));
        this.#readonlyUnsignedKeys = [...set].slice(cur);

        this.#numReadonlyUnsignedAccounts = this.#readonlyUnsignedKeys.length;

        const accountKeys = [...set];
        const indices: { [id: HexString]: number } = {};
        accountKeys.forEach((x, i) => indices[x] = i);


        const instructions = this.#instructions.map(ins => {
            const programIdIndex = accountKeys.findIndex(x => x === ins.programId);
            if (programIdIndex === -1) throw Error("Cannot reference program id");

            const keyIndicesCount = encodeLength(ins.accounts.length);
            const keyIndices = Buffer.from(ins.accounts.map(x => indices[x.publickey]));
            const dataLength = encodeLength(ins.data.length);

            return {
                programIdIndex,
                keyIndicesCount,
                keyIndices,
                dataLength,
                data: ins.data,
            };
        });

        return { accountKeys, instructions }
    }
}


function encodeLength(len: number): Buffer {
    const bytes = [];
    while (true) {
        let elem = len & 0x7f;
        len >>= 7;
        if (len == 0) {
            bytes.push(elem);
            break;
        } else {
            elem |= 0x80;
            bytes.push(elem);
        }
    }

    return Buffer.from(bytes);
}

function decodeLength(bytes: Array<number>): number {
    let len = 0;
    let size = 0;
    while (true) {
        let elem = bytes.shift()!;
        len |= (elem & 0x7f) << (size * 7);
        size += 1;
        if ((elem & 0x80) === 0) {
            break;
        }
    }
    return len;
}
