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


import { Base58 } from "@secux/utility/lib/bs58";
import { sha256 } from "hash.js";
import * as nacl from "tweetnacl";


export function toPublickey(account: string) {
    return Base58.decode(account).toString("hex");
}

const MAX_SEED_LENGTH = 32;
export function createProgramAccount(seeds: Array<Uint8Array>, programId: Buffer): Buffer {
    let buffer = Buffer.alloc(0);
    seeds.forEach(seed => {
        if (seed.length > MAX_SEED_LENGTH) throw new TypeError(`Max seed length exceeded`);
        buffer = Buffer.concat([buffer, seed]);
    });
    buffer = Buffer.concat([
        buffer,
        programId,
        Buffer.from('ProgramDerivedAddress'),
    ]);

    let publicKeyBytes = Buffer.from(sha256().update(buffer).digest());
    if (isOnCurve(publicKeyBytes)) throw new Error(`Invalid seeds, address must fall off the curve`);

    return publicKeyBytes;
}

export function createWithSeed(pubkey: Buffer, seed: string, programId: Buffer): Buffer {
    const buf = Buffer.concat([
        pubkey,
        Buffer.from(seed),
        programId
    ]);
    const pk = Buffer.from(sha256().update(buf).digest());

    return pk;
}

//@ts-ignore
const naclLowLevel = nacl.lowlevel;
const r = [
    naclLowLevel.gf(),
    naclLowLevel.gf(),
    naclLowLevel.gf(),
    naclLowLevel.gf(),
];
const t = naclLowLevel.gf(),
    chk = naclLowLevel.gf(),
    num = naclLowLevel.gf(),
    den = naclLowLevel.gf(),
    den2 = naclLowLevel.gf(),
    den4 = naclLowLevel.gf(),
    den6 = naclLowLevel.gf();
const gf1 = naclLowLevel.gf([1]);
const I = naclLowLevel.gf([
    0xa0b0, 0x4a0e, 0x1b27, 0xc4ee, 0xe478, 0xad2f, 0x1806, 0x2f43, 0xd7a7,
    0x3dfb, 0x0099, 0x2b4d, 0xdf0b, 0x4fc1, 0x2480, 0x2b83,
]);

export function isOnCurve(publickey: Uint8Array): boolean {
    naclLowLevel.set25519(r[2], gf1);
    naclLowLevel.unpack25519(r[1], publickey);
    naclLowLevel.S(num, r[1]);
    naclLowLevel.M(den, num, naclLowLevel.D);
    naclLowLevel.Z(num, num, r[2]);
    naclLowLevel.A(den, r[2], den);

    naclLowLevel.S(den2, den);
    naclLowLevel.S(den4, den2);
    naclLowLevel.M(den6, den4, den2);
    naclLowLevel.M(t, den6, num);
    naclLowLevel.M(t, t, den);

    naclLowLevel.pow2523(t, t);
    naclLowLevel.M(t, t, num);
    naclLowLevel.M(t, t, den);
    naclLowLevel.M(t, t, den);
    naclLowLevel.M(r[0], t, den);

    naclLowLevel.S(chk, r[0]);
    naclLowLevel.M(chk, chk, den);
    if (neq25519(chk, num)) naclLowLevel.M(r[0], r[0], I);

    naclLowLevel.S(chk, r[0]);
    naclLowLevel.M(chk, chk, den);
    if (neq25519(chk, num)) return false;
    return true;
}

function neq25519(a: any, b: any) {
    const c = new Uint8Array(32);
    const d = new Uint8Array(32);
    naclLowLevel.pack25519(c, a);
    naclLowLevel.pack25519(d, b);
    return naclLowLevel.crypto_verify_32(c, 0, d, 0);
}