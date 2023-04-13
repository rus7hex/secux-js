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


import * as varuint from "varuint-bitcoin";
import { BigNumber } from "bignumber.js";
export { BufferReader, BufferWriter };


/**
 * Helper class for serialization of bitcoin data types into a pre-allocated buffer.
 */
class BufferWriter {
    buffer: Buffer;
    offset: number;

    constructor(buffer: Buffer, offset = 0) {
        this.buffer = buffer;
        this.offset = offset;
    }

    writeUInt8(i: number) {
        this.offset = this.buffer.writeUInt8(i, this.offset);
    }
    writeInt32(i: number) {
        this.offset = this.buffer.writeInt32LE(i, this.offset);
    }
    writeUInt32(i: number) {
        this.offset = this.buffer.writeUInt32LE(i, this.offset);
    }
    writeUInt64(i: BigNumber.Value) {
        this.offset = writeUInt64LE(this.buffer, i, this.offset);
    }
    writeVarInt(i: number) {
        varuint.encode(i, this.buffer, this.offset);
        this.offset += varuint.encode.bytes;
    }
    writeSlice(slice: Buffer) {
        if (this.buffer.length < this.offset + slice.length) {
            throw new Error('Cannot write slice out of bounds');
        }
        this.offset += slice.copy(this.buffer, this.offset);
    }
    writeVarSlice(slice: Buffer) {
        this.writeVarInt(slice.length);
        this.writeSlice(slice);
    }
    writeVector(vector: Array<Buffer>) {
        this.writeVarInt(vector.length);
        vector.forEach(buf => this.writeVarSlice(buf));
    }
}


/**
 * Helper class for reading of bitcoin data types from a buffer.
 */
class BufferReader {
    #buffer: Buffer;
    offset: number;

    constructor(buffer: Buffer, offset = 0) {
        this.#buffer = Buffer.from([...buffer]);
        this.offset = offset;
    }

    readUInt8() {
        const result = this.#buffer.readUInt8(this.offset);
        this.offset += 1;
        return result;
    }
    readInt32() {
        const result = this.#buffer.readInt32LE(this.offset);
        this.offset += 4;
        return result;
    }
    readUInt32() {
        const result = this.#buffer.readUInt32LE(this.offset);
        this.offset += 4;
        return result;
    }
    readUInt64() {
        const result = readUInt64LE(this.#buffer, this.offset);
        this.offset += 8;
        return result;
    }
    readVarInt() {
        const vi = varuint.decode(this.#buffer, this.offset);
        this.offset += varuint.decode.bytes;
        return vi;
    }
    readSlice(n: number) {
        if (this.#buffer.length < this.offset + n) {
            throw new Error('Cannot read slice out of bounds');
        }
        const result = this.#buffer.slice(this.offset, this.offset + n);
        this.offset += n;
        return result;
    }
    readVarSlice() {
        return this.readSlice(this.readVarInt());
    }
    readVector() {
        const count = this.readVarInt();
        const vector: Buffer[] = [];
        for (let i = 0; i < count; i++) vector.push(this.readVarSlice());
        return vector;
    }
}


// https://github.com/feross/buffer/blob/master/index.js#L1127
function verifuint(value: any) {
    if (typeof value !== 'number')
        throw new Error('cannot write a non-number as a number');
    if (value < 0)
        throw new Error('specified a negative value for writing an unsigned value');
    if (Math.floor(value) !== value)
        throw new Error('value has a fractional component');
}

function writeUInt64LE(buffer: Buffer, value: BigNumber.Value, offset: number) {
    const num = new BigNumber(value);
    verifuint(num.toNumber());
    const buf = Buffer.from(num.toString(16).padStart(16, '0'), "hex");
    buf.reverse().copy(buffer, offset);
    return offset + 8;
}

function readUInt64LE(buffer: Buffer, offset: number) {
    const str = buffer.slice(offset, offset + 8).reverse().toString("hex")
    const value = new BigNumber(str, 16);
    verifuint(value.toNumber());
    return value;
}
