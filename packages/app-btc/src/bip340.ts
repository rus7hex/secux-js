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


import { taggedHash } from "./utils";
const BigInteger = require("bigi");
const ecurve = require('ecurve');


const curve = ecurve.getCurveByName('secp256k1');
const G = curve.G;
const p = curve.p;
const n = curve.n;
const zero = BigInteger.ZERO;
const one = BigInteger.ONE;
const two = BigInteger.valueOf(2);
const three = BigInteger.valueOf(3);
const four = BigInteger.valueOf(4);
const seven = BigInteger.valueOf(7);


export function taprootConvert(XOnlyPubkey: Buffer, commitHash: Buffer) {
    const P = liftX(XOnlyPubkey);
    const tweak = BigInteger.fromBuffer(commitHash);
    const Q = P.add(G.multiply(tweak));

    return Q.affineX.toBuffer(32);
}

export function taprootVerify(signature: Buffer, message: Buffer, XOnlyPubkey: Buffer): boolean {
    const P = liftX(XOnlyPubkey);
    const Px = P.affineX.toBuffer(32);

    const r = BigInteger.fromBuffer(signature.slice(0, 32));
    const s = BigInteger.fromBuffer(signature.slice(32, 64));
    if (r.compareTo(p) >= 0) return false;
    if (s.compareTo(n) >= 0) return false;

    const e = getE(r.toBuffer(32), Px, message);
    const R = getR(s, e, P);
    if (R.curve.isInfinity(R) || !isEven(R) || !R.affineX.equals(r)) return false;

    return true;
}

function liftX(XOnlyPubkey: Buffer) {
    const x = BigInteger.fromBuffer(XOnlyPubkey);

    const c = x.pow(three).add(seven).mod(p);
    const y = c.modPow(p.add(one).divide(four), p);
    if (c.compareTo(y.modPow(two, p)) !== 0) {
        throw new Error('c is not equal to y^2');
    }

    let P = ecurve.Point.fromAffine(curve, x, y);
    if (!isEven(P)) {
        P = ecurve.Point.fromAffine(curve, x, p.subtract(y));
    }

    return P;
}

function isEven(point: any): boolean {
    return point.affineY.mod(two).equals(zero);
}

function getE(Rx: Buffer, Px: Buffer, m: Buffer) {
    const hash = taggedHash('BIP0340/challenge', Buffer.concat([Rx, Px, m]));
    return BigInteger.fromBuffer(hash).mod(n);
}

function getR(s: any, e: any, P: any) {
    const sG = G.multiply(s);
    const eP = P.multiply(e);
    return sG.add(eP.negate());
}