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
import { sha256 } from "js-sha256";
const ripemd160 = require("ripemd160");
import { encode, encodeForSigning } from 'ripple-binary-codec';
const bip66 = require('bip66');
import ow from "ow";
import { IPlugin, ITransport, staticImplements } from '@secux/transport';
import { loadPlugin, owTool, ow_strictPath, Signature } from "@secux/utility";
import { SecuxTransactionTool } from "@secux/protocol-transaction";
import { EllipticCurve } from "@secux/protocol-transaction/lib/interface";
import { communicationData, getBuffer, ow_communicationData, toCommunicationData, wrapResult } from '@secux/utility/lib/communication';
import { baseObject, ow_baseObject, validator } from './interface';
const secp256k1 = require('secp256k1/elliptic');
export { SecuxXRP };

const base58 = bs58('rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz');
const ow_path = ow_strictPath(144, 44);


/**
 * XRP package for SecuX device
 */
@staticImplements<IPlugin>()
class SecuxXRP {
    /**
     * Convert secp256k1 publickey to XRP address.
     * @param {string|Buffer} publickey secp256k1 publickey
     * @returns {string} XRP address
     */
    static addressConvert(publickey: string | Buffer): string {
        const pk = getPublickey(publickey);
        const pubkeyInnerHash = sha256.create().update(pk).digest();
        const pubkeyOuterHash = new ripemd160().update(Buffer.from(pubkeyInnerHash)).digest("hex");

        const prefix = Buffer.from([0]);
        const data = Buffer.concat([prefix, Buffer.from(pubkeyOuterHash, "hex")]);
        const checksumHash1 = sha256.create().update(data).digest();
        const checksumHash2 = sha256.create().update(checksumHash1).digest();
        const checksum = checksumHash2.slice(0, 4);
        const dataToEncode = Buffer.concat([data, Buffer.from(checksum)]);
        const address = base58.encode(dataToEncode);

        return address;
    }

    /**
     * Prepare data for XRP address.
     * @param {string} path m/44'/144'/...
     * @returns {communicationData} data for sending to device
     */
    static prepareAddress(path: string): communicationData {
        return this.preparePublickey(path);
    }

    /**
     * Generate XRP address from response data.
     * @param {communicationData} response data from device
     * @returns {string} XRP address
     */
    static resolveAddress(response: communicationData) {
        return SecuxXRP.addressConvert(SecuxXRP.resolvePublickey(response));
    }

    /**
     * Prepare data for secp256k1 publickey.
     * @param {string} path m/44'/144'/...
     * @returns {communicationData} data for sending to device
     */
    static preparePublickey(path: string): communicationData {
        ow(path, ow_path);

        return SecuxTransactionTool.getPublickey(path, EllipticCurve.SECP256K1);
    }

    /**
     * Resolve secp256k1 publickey from response data.
     * @param {communicationData} response data from device
     * @returns {string} secp256k1 publickey (hex string)
     */
    static resolvePublickey(response: communicationData) {
        const pk = SecuxTransactionTool.resolvePublickey(response, EllipticCurve.SECP256K1, true);
        return Buffer.from(pk, "base64").toString("hex");
    }

    /**
     * Prepare data for xpub.
     * @param {string} path m/44'/144'/...
     * @returns {communicationData} data for sending to device
     */
    static prepareXPublickey(path: string) {
        ow(path, ow_path);
        return SecuxTransactionTool.getXPublickey(path);
    }

    /**
     * Generate xpub from response data.
     * @param {communicationData} response data from device
     * @param {string} path m/44'/144'/...
     * @returns {string} xpub
     */
    static resolveXPublickey(response: communicationData, path: string) {
        ow(path, ow_path);
        return SecuxTransactionTool.resolveXPublickey(response, path);
    }

    /**
     * Prepare data for signing.
     * @param {string} path m/44'/144'/...
     * @param {baseObject} json transaction object (same as XRP api)
     * @returns {prepared} prepared object
     */
    static prepareSign(path: string, json: baseObject): { commandData: communicationData, serialized: communicationData } {
        ow(path, ow_path);
        ow(json, ow_baseObject);

        const pk = getPublickey(json.SigningPubKey);
        const from = SecuxXRP.addressConvert(pk);
        if (!json.Account) {
            json.Account = from;
        }
        else {
            if (json.Account !== from)
                throw Error(
                    `ArgumentError: publickey doesn't match sending address, \
                    got "${from}" by publickey, expect ${json.Account}`);
        }
        json.SigningPubKey = pk.toString("hex").toUpperCase();

        json.Fee = json.Fee.toString(10);
        if (json.Amount) json.Amount = json.Amount.toString(10);

        validator[json.TransactionType](json);

        const encodedTx = encodeForSigning(json);
        const encodedTxBuffer = Buffer.from(encodedTx, "hex");

        return wrapResult({
            commandData: SecuxTransactionTool.signRawTransaction(path, encodedTxBuffer),
            serialized: toCommunicationData(Buffer.from(JSON.stringify(json)))
        });
    }

    /**
     * Resolve signature from response data.
     * @param {communicationData} response data from device
     * @returns {string} signature (hex string)
     */
    static resolveSignature(response: communicationData) {
        const sigBuffer = Buffer.from(SecuxTransactionTool.resolveSignature(response), "base64");
        const sig = Signature.fromSignature(sigBuffer);
        sig.toDER();

        const signature = Buffer.from(bip66.encode(sig.r, sig.s));
        return signature.toString("hex").toUpperCase();
    }

    /**
     * Generate raw transaction for broadcasting.
     * @param {communicationData} response data from device
     * @param {communicationData} serialized 
     * @returns {string} signed raw transaction
     */
    static resolveTransaction(response: communicationData, serialized: communicationData) {
        ow(response, ow_communicationData);
        ow(serialized, ow_communicationData);

        const txObj = JSON.parse(getBuffer(serialized).toString());
        txObj.TxnSignature = SecuxXRP.resolveSignature(response);

        return encode(txObj).toUpperCase();
    }

    static async getAddress(this: ITransport, path: string): Promise<string> {
        const data = SecuxXRP.prepareAddress(path);
        const rsp = await this.Exchange(getBuffer(data));
        const address = SecuxXRP.resolveAddress(rsp);

        return address;
    }

    static async getPublickey(this: ITransport, path: string): Promise<string> {
        const data = SecuxXRP.preparePublickey(path);
        const rsp = await this.Exchange(getBuffer(data));
        const publickey = SecuxXRP.resolvePublickey(rsp);

        return publickey;
    }

    static async getXPublickey(this: ITransport, path: string): Promise<string> {
        const data = SecuxXRP.prepareXPublickey(path);
        const rsp = await this.Exchange(getBuffer(data));
        const xpub = SecuxXRP.resolveXPublickey(rsp, path);

        return xpub;
    }

    static async sign(this: ITransport, path: string, json: baseObject): Promise<{ raw_tx: string; signature: string; }> {
        ow(path, ow_path);

        if (!json.SigningPubKey) {
            const publickey = await SecuxXRP.getPublickey.call(this, path);
            json.SigningPubKey = publickey.toUpperCase();
        }

        const { commandData, serialized } = SecuxXRP.prepareSign(path, json);
        const rsp = await this.Exchange(getBuffer(commandData));
        const raw_tx = SecuxXRP.resolveTransaction(rsp, serialized);
        const signature = SecuxXRP.resolveSignature(rsp);

        return { raw_tx, signature };
    }
}

loadPlugin(SecuxXRP, "SecuxXRP");


function getPublickey(data: string | Buffer) {
    ow(data, ow.any(owTool.hexString, ow.buffer));

    let pk = (typeof data === "string") ? Buffer.from(data, "hex") : data;
    if (!secp256k1.publicKeyVerify(pk)) {
        throw Error(`ArgumentError: invalid secp256k1 publickey, got "${pk.toString("hex")}"`);
    }

    pk = secp256k1.publicKeyConvert(pk, true);

    return Buffer.from(pk);
}


/**
 * Data type for transmission.
 * @typedef {string|Buffer} communicationData
 */

/**
 * The payment object.
 * @typedef {object} baseObject
 * @property {string} TransactionType
 * @property {string | Buffer} SigningPubKey ed25519 publickey
 * @property {number} Sequence
 * @property {string | number} Fee
 * @property {number} LastLedgerSequence
 * @property {string} [Account] sending address
 * @property {string} [Destination] receiving address
 * @property {string | number} [Amount] 
 * @property {number} [SourceTag]
 * @property {number} [DestinationTag]
 */

/**
 * Object for the signing and validation.
 * @typedef {object} prepared
 * @property {commandData} commandData data for sending to device
 * @property {commandData} serialized 
 */