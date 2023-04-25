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


import { Crypto } from "./crypto";
import { taggedHash } from "./hashdef";
import { recidFromSignature } from "@secux/utility/lib/secp256k1";
import { pbkdf2Sync } from "pbkdf2";
const randomBytes = require("randombytes");


const MASTER_SECRET = Buffer.from('Bitcoin seed', 'utf8');
const ED25519_SECRET = Buffer.from("ed25519 seed", "utf8");
const HARDENED_OFFSET = 0x80000000;

// Order of the curve (N) - 1
const N_LESS_1 = Buffer.from(
    'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140',
    'hex',
);
// 1 represented as 32 bytes BE
const ONE = Buffer.from(
    '0000000000000000000000000000000000000000000000000000000000000001',
    'hex',
);


export interface IHDKey {
    derive(path: string): IHDKey;
    sign(hash: Uint8Array): Buffer;
    verify(hash: Uint8Array, signature: Uint8Array): boolean
}


type HDKeyConfig = {
    lowR?: boolean,
    compressed?: boolean
}


export class HDKey implements IHDKey {
    #lowR;
    #compressed;
    depth = 0;
    index = 0;
    #privateKey: Buffer | undefined;
    #publicKey: Buffer | undefined;
    #chainCode: Buffer | undefined;
    #fingerprint: number | undefined;
    parentFingerprint: number | undefined;


    constructor(config?: HDKeyConfig) {
        this.#lowR = config?.lowR ?? false;
        this.#compressed = config?.compressed ?? true;
    }

    static fromMasterSeed(seedBuffer: Buffer, config?: HDKeyConfig) {
        const I = Buffer.from(
            Crypto.hmacSha512(MASTER_SECRET, seedBuffer)
        );
        const IL = I.slice(0, 32);
        const IR = I.slice(32);

        const hdkey = new HDKey(config);
        hdkey.#setPrivateKey(IL);
        hdkey.#chainCode = IR;

        return hdkey
    }

    static #from(hdkey: HDKey) {
        return new HDKey({
            lowR: hdkey.#lowR,
            compressed: hdkey.#compressed
        });
    }

    derive(path: string): HDKey {
        let splitPath = path.split('/');
        if (splitPath[0] === 'm') {
            if (this.parentFingerprint)
                throw new TypeError('Expected master, got child');

            splitPath = splitPath.slice(1);
        }

        return splitPath.reduce(
            (prevHd, indexStr) => {
                let index;
                if (indexStr.slice(-1) === `'`) {
                    index = parseInt(indexStr.slice(0, -1), 10);
                    return prevHd.#deriveChild(index + HARDENED_OFFSET);
                } else {
                    index = parseInt(indexStr, 10);
                    return prevHd.#deriveChild(index);
                }
            },
            this as HDKey,
        );
    }

    #deriveChild(index: number): HDKey {
        const isHardened = index >= HARDENED_OFFSET;

        const data = Buffer.allocUnsafe(37);

        // Hardened child
        if (isHardened) {
            if (!this.#privateKey) throw Error('Missing private key for hardened child key');

            // data = 0x00 || ser256(kpar) || ser32(index)
            data[0] = 0x00;
            this.#privateKey.copy(data, 1);
            data.writeUInt32BE(index, 33);
        }
        // Normal child
        else {
            // data = serP(point(kpar)) || ser32(index)
            //      = serP(Kpar) || ser32(index)
            this.#publicKey!.copy(data, 0);
            data.writeUInt32BE(index, 33);
        }

        const I = Buffer.from(Crypto.hmacSha512(this.#chainCode!, data));
        const IL = I.slice(0, 32);
        const IR = I.slice(32);


        // if parse256(IL) >= n, proceed with the next value for i
        if (!Crypto.secp256k1.isPrivate(IL)) return this.#deriveChild(index + 1);


        // Private parent key -> private child key
        let hd: HDKey;
        if (this.#privateKey) {
            try {
                // ki = parse256(IL) + kpar (mod n)
                const ki = Buffer.from(Crypto.secp256k1.privateAdd(this.#privateKey, IL));

                hd = HDKey.#from(this);
                hd.#setPrivateKey(ki);
                // throw if IL >= n || (privateKey + IL) === 0
            } catch (err) {
                // In case parse256(IL) >= n or ki == 0, one should proceed with the next value for i
                return this.#deriveChild(index + 1);
            }
        }
        // Public parent key -> public child key
        else {
            try {
                // Ki = point(parse256(IL)) + Kpar
                //    = G*IL + Kpar
                const Ki = Buffer.from(Crypto.secp256k1.pointAdd(this.#publicKey!, IL, true));

                hd = HDKey.#from(this);
                hd.#setPublicKey(Ki);
                // throw if IL >= n || (g**IL + publicKey) is infinity
            } catch (err) {
                // In case parse256(IL) >= n or Ki is the point at infinity, one should proceed with the next value for i
                return this.#deriveChild(index + 1);
            }
        }

        hd.#chainCode = IR;
        hd.depth = this.depth + 1;
        hd.parentFingerprint = this.#fingerprint;
        hd.index = index;

        return hd;
    }

    sign(hash: Uint8Array): Buffer {
        if (!this.#privateKey) throw new Error('Missing private key');

        const getSignature = (hash: Uint8Array, extra?: Uint8Array) => {
            const signed = Crypto.secp256k1.sign(hash, this.#privateKey!, extra);
            const recid = recidFromSignature(hash, this.#publicKey!, signed);

            return Buffer.concat([
                signed,
                Uint8Array.from([recid])
            ]);
        };

        if (!this.#lowR) {
            return getSignature(hash);
        } else {
            let sig = getSignature(hash);
            const extraData = Buffer.alloc(32, 0);
            let counter = 0;
            // if first try is lowR, skip the loop
            // for second try and on, add extra entropy counting up
            while (sig[0] > 0x7f) {
                counter++;
                extraData.writeUIntLE(counter, 0, 6);

                sig = getSignature(hash, extraData);
            }
            return sig;
        }
    }

    signTweaked(hash: Uint8Array): Buffer {
        if (!this.#privateKey) throw new Error('Missing private key');
        if (!this.#publicKey) throw new Error('Missing public key');


        const privateKey =
            this.#publicKey[0] === 2
                ? this.#privateKey
                : Crypto.secp256k1.privateAdd(
                    Crypto.secp256k1.privateSub(N_LESS_1, this.#privateKey)!,
                    ONE)!;
        const tweakHash = taggedHash(this.#publicKey.slice(1, 33), "TapTweak");
        const newPrivateKey = Crypto.secp256k1.privateAdd(privateKey!, tweakHash);
        if (newPrivateKey === null) throw new Error('Invalid Tweak');

        return Buffer.from([
            // use random bytes for extra entropy
            ...Crypto.secp256k1.signSchnorr(hash, newPrivateKey, randomBytes(32)),
            0xFF
        ]);
    }

    verify(hash: Uint8Array, signature: Uint8Array): boolean {
        return Crypto.secp256k1.verify(hash, this.#publicKey!, signature);
    }

    verifySchnorr(hash: Uint8Array, signature: Uint8Array): boolean {
        return Crypto.secp256k1.verifySchnorr(hash, this.#publicKey!, signature);
    }


    #setPrivateKey(value: Buffer) {
        if (value.length !== 32) throw Error('Private key must be 32 bytes.');
        if (!Crypto.secp256k1.isPrivate(value)) throw Error('Invalid private key');

        this.#privateKey = value;
        this.#publicKey = Buffer.from(Crypto.secp256k1.pointFromScalar(value, true));
        const pubkeyHash = Buffer.from(Crypto.hash160(this.#publicKey));
        this.#fingerprint = pubkeyHash.slice(0, 4).readUInt32BE(0);
    }

    #setPublicKey(value: Buffer) {
        if (value.length !== 33 && value.length !== 65) throw Error('Public key must be 33 or 65 bytes.');
        if (!Crypto.secp256k1.isPoint(value)) throw Error('Invalid public key');

        this.#publicKey = Buffer.from(Crypto.secp256k1.pointCompress(value, true));
        const pubkeyHash = Buffer.from(Crypto.hash160(this.#publicKey));
        this.#fingerprint = pubkeyHash.slice(0, 4).readUInt32BE(0);
        this.#privateKey = undefined;
    }

    get publicKey() {
        if (!this.#publicKey) return undefined;

        return Buffer.from(
            Crypto.secp256k1.pointCompress(this.#publicKey, this.#compressed)
        );
    }
    get chainCode() { return this.#chainCode; }
    get fingerprint() { return this.#fingerprint; }
}


export class HDKeyED25519 implements IHDKey {
    #privateKey: Buffer | undefined;
    #publicKey: Buffer | undefined;
    #chainCode: Buffer | undefined;
    #fingerprint: number | undefined;
    depth = 0;
    index = 0;
    parentFingerprint: number | undefined;


    static fromMasterSeed(seedBuffer: Buffer) {
        const I = Buffer.from(
            Crypto.hmacSha512(ED25519_SECRET, seedBuffer)
        );
        const IL = I.slice(0, 32);
        const IR = I.slice(32);

        const hdkey = new HDKeyED25519();
        hdkey.#setPrivateKey(IL);
        hdkey.#chainCode = IR;

        return hdkey;
    }

    derive(path: string): HDKeyED25519 {
        let splitPath = path.split('/');
        if (splitPath[0] === 'm') {
            if (this.parentFingerprint)
                throw new TypeError('Expected master, got child');

            splitPath = splitPath.slice(1);
        }

        return splitPath.reduce(
            (prevHd, indexStr) => {
                let index;
                if (indexStr.slice(-1) === `'`) {
                    index = parseInt(indexStr.slice(0, -1), 10);
                    return prevHd.#deriveChild(index + HARDENED_OFFSET);
                } else {
                    throw Error("Curve ed25519 only support hardened child key");
                }
            },
            this as HDKeyED25519,
        );
    }

    sign(hash: Uint8Array): Buffer {
        if (!this.#privateKey) throw Error('Missing private key');

        const signature = Crypto.ed25519.sign.detached(hash, Buffer.concat([this.#privateKey, this.#publicKey!]));
        return Buffer.from([...signature, 0x00]);
    }

    verify(hash: Uint8Array, signature: Uint8Array): boolean {
        return Crypto.ed25519.sign.detached.verify(hash, signature, this.#publicKey!);
    }

    get publicKey() { return this.#publicKey; }
    get chainCode() { return this.#chainCode; }
    get fingerprint() { return this.#fingerprint; }

    #setPrivateKey(value: Buffer) {
        if (value.length !== 32) throw Error('Private key must be 32 bytes.');

        this.#privateKey = value;
        const keypair = Crypto.ed25519.sign.keyPair.fromSeed(value);
        this.#publicKey = Buffer.from(keypair.publicKey);
        const pubkeyHash = Buffer.from(Crypto.hash160(this.#publicKey));
        this.#fingerprint = pubkeyHash.slice(0, 4).readUInt32BE(0);
    }

    #deriveChild(index: number): HDKeyED25519 {
        if (!this.#privateKey) throw Error('Missing private key');

        const data = Buffer.allocUnsafe(37);

        // data = 0x00 || ser256(kpar) || ser32(index)
        data[0] = 0x00;
        this.#privateKey.copy(data, 1);
        data.writeUInt32BE(index, 33);

        const I = Buffer.from(Crypto.hmacSha512(this.#chainCode!, data));
        const IL = I.slice(0, 32);
        const IR = I.slice(32);

        const hd = new HDKeyED25519();
        hd.#setPrivateKey(IL);
        hd.#chainCode = IR;
        hd.depth = this.depth + 1;
        hd.parentFingerprint = this.#fingerprint;
        hd.index = index;

        return hd;
    }
}


// spec: https://github.com/cardano-foundation/CIPs/blob/master/CIP-0003/Ledger.md
// refer to https://github.com/LedgerHQ/orakolo/blob/0b2d5e669ec61df9a824df9fa1a363060116b490/src/python/orakolo/HDEd25519.py
export class BIP32ED25519 implements IHDKey {
    #privateKey: Buffer | undefined;
    #publicKey: Buffer | undefined;
    #chainCode: Buffer | undefined;


    static generateSeed(mnemonic: string, passphrase = ''): Buffer {
        const seed = pbkdf2Sync(
            mnemonic.normalize("NFKD"),
            `mnemonic${passphrase}`.normalize("NFKD"),
            2048,
            64,
            "sha512"
        );

        return seed;
    }

    static fromMasterSeed(seedBuffer: Buffer): BIP32ED25519 {
        let I = Buffer.from(Crypto.hmacSha512(ED25519_SECRET, seedBuffer));
        let IL = I.slice(0, 32);
        let IR = I.slice(32);

        let secret = seedBuffer;
        while ((IL[31] & 0b00100000) !== 0) {
            secret = I;
            I = Buffer.from(Crypto.hmacSha512(ED25519_SECRET, secret));
            IL = I.slice(0, 32);
            IR = I.slice(32);
        }

        IL[0] &= 0b11111000;
        IL[31] &= 0b01111111;
        IL[31] |= 0b01000000;

        const hdkey = new BIP32ED25519();
        hdkey.#privateKey = Buffer.concat([IL, IR]);
        hdkey.#publicKey = Buffer.from(Crypto.ed25519_ada.toPublic(hdkey.#privateKey));
        hdkey.#chainCode = Buffer.from(Crypto.hmacSha256(ED25519_SECRET, Buffer.from([0x01, ...seedBuffer])));

        return hdkey;
    }

    derive(path: string): BIP32ED25519 {
        let splitPath = path.split('/');
        if (splitPath[0] === 'm') splitPath = splitPath.slice(1);

        return splitPath.reduce(
            (prevHd, indexStr) => {
                let index;
                if (indexStr.slice(-1) === `'`) {
                    index = parseInt(indexStr.slice(0, -1), 10);
                    return prevHd.#deriveChild(index + HARDENED_OFFSET);
                } else {
                    index = parseInt(indexStr, 10);
                    return prevHd.#deriveChild(index);
                }
            },
            this as BIP32ED25519,
        );
    }

    sign(hash: Uint8Array): Buffer {
        if (!this.#privateKey) throw Error('Missing private key');

        const signature = Crypto.ed25519_ada.sign(hash, Buffer.concat([this.#privateKey, this.#publicKey!, this.#chainCode!]));
        return Buffer.from([...signature, 0x00]);
    }

    verify(hash: Uint8Array, signature: Uint8Array): boolean {
        return Crypto.ed25519_ada.verify(hash, this.#publicKey, signature);
    }

    get publicKey() { return this.#publicKey; }
    get chainCode() { return this.#chainCode; }


    #setPrivateKey(value: Buffer) {
        if (value.length !== 64) throw Error('Private key must be 64 bytes.');

        this.#privateKey = value;
        this.#publicKey = Buffer.from(Crypto.ed25519_ada.toPublic(value));
    }

    #deriveChild(index: number): BIP32ED25519 {
        if (!this.#privateKey) throw Error('Missing private key');

        const xprv = Crypto.ed25519_ada.derivePrivate(
            Buffer.concat([this.#privateKey, this.#publicKey!, this.#chainCode!]),
            index,
            2
        );

        const hd = new BIP32ED25519();
        hd.#setPrivateKey(Buffer.from(xprv.slice(0, 64)));
        hd.#chainCode = Buffer.from(xprv.slice(96));

        return hd;
    }
}
