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


import * as bs58 from 'base-x';

export const Base58 = bs58('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz');
export type HashFunc = (data: Buffer) => Buffer;


export class bs58Check {
    #hash: HashFunc;

    constructor(hash: HashFunc) {
        this.#hash = hash;
    }

    encode(payload: Buffer, prefix?: Buffer) {
        const data = (prefix) ? Buffer.concat([prefix, payload]) : payload;

        const hashForChecksum = this.#hash(data);

        const checksum = hashForChecksum.slice(0, 4)
        const dataToEncode = Buffer.concat([data, checksum]);
        const address = Base58.encode(dataToEncode);

        return address;
    }

    decode(address: string) {
        const dataToEncode = Base58.decode(address);
        const payload = DecodeToPayload(dataToEncode, this.#hash);

        return payload;
    }
}


function DecodeToPayload(data: Buffer, check: (payload: Buffer) => Buffer) {
    const payload = data.slice(0, -4);
    const checksum = data.slice(-4);
    const comparedChecksum = check(payload);

    if ((checksum[0] ^ comparedChecksum[0]) |
        (checksum[1] ^ comparedChecksum[1]) |
        (checksum[2] ^ comparedChecksum[2]) |
        (checksum[3] ^ comparedChecksum[3]))
        throw new Error('decode failed, Invalid data');

    return payload;
}