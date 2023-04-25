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


import { sha256, sha512, ripemd160, hmac } from "hash.js";
const createHash = require('keccak');
import * as nacl from "tweetnacl";
const cardano = require("cardano-crypto.js");
export { Crypto };


class Crypto {
    static hmacSha256(secret: Uint8Array, message: Uint8Array): Uint8Array {
        //@ts-ignore
        const h = hmac(sha256, secret);
        return Uint8Array.from(h.update(message).digest());
    }

    static hmacSha512(secret: Uint8Array, message: Uint8Array): Uint8Array {
        //@ts-ignore
        const h = hmac(sha512, secret);
        return Uint8Array.from(h.update(message).digest());
    }

    static hash160(buf: Uint8Array): Uint8Array {
        const sha = Crypto.sha256(buf);
        return Crypto.ripemd160(sha);
    }

    static hash256(buf: Uint8Array): Uint8Array {
        const sha = Crypto.sha256(buf);
        return Crypto.sha256(sha);
    }

    static sha256(data: Uint8Array): Uint8Array {
        return Uint8Array.from(sha256().update(data).digest());
    }

    static sha512(data: Uint8Array): Uint8Array {
        return Uint8Array.from(sha512().update(data).digest());
    }

    static ripemd160(data: Uint8Array): Uint8Array {
        return Uint8Array.from(ripemd160().update(data).digest());
    }

    static keccak256(data: Uint8Array): Uint8Array {
        return createHash("keccak256")
            .update(Buffer.from(data))
            .digest();
    }

    static get secp256k1(): any {
        throw Error("module not loaded.");
    }

    static readonly ed25519 = Object.freeze(nacl);

    static readonly ed25519_ada = Object.freeze(cardano);
}


(async () => {
    const schnorr = await import("tiny-secp256k1");
    Object.defineProperty(Crypto, "secp256k1", {
        enumerable: true,
        configurable: false,
        writable: false,
        value: Object.freeze(schnorr)
    });
})();

Object.defineProperty(Crypto, "ed25519", {
    enumerable: true,
    configurable: false,
    writable: false
});

Object.defineProperty(Crypto, "ed25519_ada", {
    enumerable: true,
    configurable: false,
    writable: false
});
