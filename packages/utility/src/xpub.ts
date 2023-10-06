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


import { splitPath, HARDENED_OFFSET } from "./BIP32Path";
import { bs58Check } from "./bs58";
import { hmac, sha256, sha512 } from "hash.js";
import { ec } from "elliptic";
import ow from "ow";
import { Logger, ow_checkBufferLength, owTool } from "./utility";
const groestl = require("groestl-hash-js");
const logger = Logger?.child({ id: "utility" });


const secp256k1 = new ec("secp256k1");
const BN = secp256k1.curve.n.constructor;
const XKEY_LEN = 78;
const BIP44_prefix = 0x0488b21e;
const BIP49_prefix = 0x049d7cb2;
const BIP84_prefix = 0x04b24746;


/**
 * Convert publicKey to extended publicKey
 * @param {string} path BIP32
 * @param {Buffer} parentFingerPrint byte(4)
 * @param {Buffer} chainCode byte(32)
 * @param {Buffer} publicKey byte(33)
 * @returns {String} extended publicKey
 */
export function toExtenededPublicKey(path: string, parentFingerPrint: Buffer, chainCode: Buffer, publicKey: Buffer) {
    ow(path, owTool.bip32String);
    ow(parentFingerPrint, ow_checkBufferLength(4));
    ow(chainCode, ow_checkBufferLength(32));
    ow(publicKey, ow_checkBufferLength(33));


    // => version(4) || depth(1) || fingerprint(4) || index(4) || chain(32) || key(33)
    const buffer = Buffer.allocUnsafe(XKEY_LEN);

    const bip44 = splitPath(path);
    switch (bip44.purpose!.value) {
        case 44:
            buffer.writeUInt32BE(BIP44_prefix, 0);
            break;

        case 49:
            buffer.writeUInt32BE(BIP49_prefix, 0);
            break;

        case 84:
            buffer.writeUInt32BE(BIP84_prefix, 0);
            break;

        case 86:
            buffer.writeUInt32BE(BIP44_prefix, 0);
            break;

        default:
            throw Error("unsupported purpose of path");
    }

    const depth = bip44.pathNum;
    buffer.writeUInt8(depth, 4);

    const fingerprint = (depth > 0) ? parentFingerPrint : Buffer.alloc(4);
    fingerprint.copy(buffer, 5);

    let element;
    switch (depth) {
        case 1: element = bip44.purpose!; break;
        case 2: element = bip44.coinType!; break;
        case 3: element = bip44.accountId!; break;
        case 4: element = bip44.change!; break;
        case 5: element = bip44.addressIndex!; break;

        default: throw Error("Invalid Path, only support 1 to 5 depth path");
    }
    const index = element.isHardened ? element.value + HARDENED_OFFSET : element?.value;
    buffer.writeUInt32BE(index, 9);

    chainCode.copy(buffer, 13);

    publicKey.copy(buffer, 45);

    if (bip44.coinType?.value === 17) return bs58_GRS.encode(buffer);

    return bs58_BTC.encode(buffer);
}

export function convertXpubMagic(xpub: string, magic: number) {
    let result = '';
    try {
        const payload = bs58_BTC.decode(xpub);
        payload.writeUInt32BE(magic, 0);
        result = bs58_BTC.encode(payload);
    }
    catch (error) {
        logger?.warn(`The xpub is not Bitcoin compatible, try use Groestlcoin version:\n${xpub}`);
        const payload = bs58_GRS.decode(xpub);
        payload.writeUInt32BE(magic, 0);
        result = bs58_GRS.encode(payload);
    }

    return result;
}

export function decodeXPUB(xpub: string) {
    ow(xpub, owTool.xpubString);

    let payload
    try {
        payload = bs58_BTC.decode(xpub);
    }
    catch (error) {
        logger?.warn(`The xpub is not Bitcoin compatible, try use Groestlcoin version:\n${xpub}`);
        payload = bs58_GRS.decode(xpub);
    }


    let purpose;
    const prefix = payload.readUInt32BE(0);
    switch (prefix) {
        case BIP44_prefix:
            purpose = 44;
            logger?.warn("Please note that TapRoot type xpub using the same prefix, it cannot be considered here.");
            break;

        case BIP49_prefix:
            purpose = 49;
            break;

        case BIP84_prefix:
            purpose = 84;
            break;

        default:
            throw Error(`unsupport prefix, got 0x${payload.slice(0, 4)}`);
    }

    const depth = payload.readUInt8(4);
    const fingerprint = payload.slice(5, 9);
    const chaincode = payload.slice(13, 45);
    const publickey = payload.slice(45);

    return { purpose, depth, publickey, chaincode, fingerprint }
}

export function deriveKey(publickey: Buffer, chaincode: Buffer, indexArray: Array<number>): { publickey: Buffer, chaincode: Buffer } {
    ow(publickey, ow_checkBufferLength(33));
    ow(chaincode, ow_checkBufferLength(32));
    ow(indexArray, ow.array.ofType(ow.number.uint32));


    let xpub = { publickey, chaincode };
    for (const index of indexArray) {
        xpub = derive(xpub.publickey, xpub.chaincode, index);
    }

    return xpub;
}

function Hash256(data: Buffer) {
    const sha = sha256().update(data).digest();
    return Buffer.from(sha256().update(sha).digest());
}

function GRSHash(data: Buffer) {
    return Buffer.from(groestl.groestl_2(data, 1, 1));
}

const bs58_BTC = new bs58Check(Hash256);
const bs58_GRS = new bs58Check(GRSHash);


function derive(publickey: Buffer, chaincode: Buffer, index: number): { publickey: Buffer, chaincode: Buffer } {
    const data = Buffer.allocUnsafe(37);
    publickey.copy(data, 0);

    // data = serP(point(kpar)) || ser32(index)
    //      = serP(Kpar) || ser32(index)
    data.writeUInt32BE(index, 33);

    //@ts-ignore
    const h = hmac(sha512, chaincode);
    const hmacSha512 = h.update(data).digest();

    const I = Buffer.from(hmacSha512);
    const IL = I.slice(0, 32);
    const IR = I.slice(32);

    // Public parent key -> public child key
    let Ki;
    try {
        // Ki = point(parse256(IL)) + Kpar
        //    = G*IL + Kpar
        const pair = secp256k1.keyFromPublic(publickey);
        const tweak = new BN(IL);
        if (tweak.cmp(secp256k1.curve.n) >= 0) throw Error("tweak error");

        const point = pair.getPublic().add(secp256k1.curve.g.mul(tweak));
        if (point.isInfinity()) throw Error("point error");

        Ki = Buffer.from(point.encode("array", true));

        // throw if IL >= n || (g**IL + publicKey) is infinity
    } catch (err) {
        // In case parse256(IL) >= n or Ki is the point at infinity, one should proceed with the next value for i
        return derive(publickey, chaincode, index + 1);
    }

    return {
        publickey: Ki,
        chaincode: IR
    }
}