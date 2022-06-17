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


import { ec } from "elliptic";
import * as BN from "bn.js";


export function validate(pubkey: Buffer): boolean {
    const secp256k1 = new ec("secp256k1");
    const key = secp256k1.keyFromPublic(pubkey);
    const { result, reason } = key.validate();

    if (!!reason) console.warn(reason);

    return result;
}

export function recidFromSignature(payload: Uint8Array, publicKey: Uint8Array, signature: Uint8Array): number {
    const secp256k1 = new ec("secp256k1");
    const n = secp256k1.curve.n;
    const G = secp256k1.curve.g;

    const Q = secp256k1.curve.decodePoint(publicKey);

    const r = new BN(signature.slice(0, 32));
    const s = new BN(signature.slice(32, 64));
    const e = new BN(payload);

    const sInv = s.invm(n);

    const u1 = e.mul(sInv).umod(n);
    const u2 = r.mul(sInv).umod(n);

    const R = G.mulAdd(u1, Q, u2);

    const isOddY = R.y.isOdd();
    const isHighX = R.x.cmp(n) >= 0;
    const recid = (+isHighX << 1) | (+isOddY << 0);

    return recid;
}