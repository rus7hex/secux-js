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


import { BigNumber } from "bignumber.js";


export class Signature {
    #r: Buffer;
    #s: Buffer;
    #v: Buffer;

    constructor(r: Buffer, s: Buffer, v: Buffer) {
        this.#r = r;
        this.#s = s;
        this.#v = v;
    }

    static fromSignature(sig: Buffer) {
        const rBuffer = sig.slice(0, 32);
        const sBuffer = sig.slice(32, 32 + 32);
        const vBuffer = sig.slice(32 + 32, 32 + 32 + 1);

        return new Signature(rBuffer, sBuffer, vBuffer);
    }

    toDER() {
        this.#r = Signature.#toDER(this.#r);
        this.#s = Signature.#toDER(this.#s);
    }

    flipS(isLowerHalf: boolean = true) {
        const SECP256K1N = new BigNumber("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
        const SECP256K1N_half = new BigNumber("0x0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD036414");

        let s = new BigNumber(`0x${this.#s.toString("hex")}`);

        if ((isLowerHalf && s > SECP256K1N_half) ||
            (!isLowerHalf && s <= SECP256K1N_half)) {
            s = SECP256K1N.minus(s);
            this.#s.write(s.toString(16), "hex");

            let v = this.#v.readUInt8();
            v = 1 - v;
            this.#v.writeUInt8(v);
        }
    }

    static #toDER(x: Buffer) {
        const ZERO = Buffer.alloc(1, 0);

        let i = 0;
        while (x[i] === 0) ++i;
        if (i === x.length) return ZERO;

        x = x.slice(i);
        if (x[0] & 0x80) return Buffer.concat([ZERO, x], 1 + x.length);

        return x;
    }

    get r() { return this.#r; }
    get s() { return this.#s; }
    get v() { return this.#v; }
}