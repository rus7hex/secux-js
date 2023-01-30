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


import { SecuxTransactionTool } from "@secux/protocol-transaction";
import { EllipticCurve } from "@secux/protocol-transaction/lib/interface";
import { communicationData, getBuffer, ow_communicationData, toCommunicationData, wrapResult } from "@secux/utility/lib/communication";
import { loadPlugin, ow_strictPath, Signature } from "@secux/utility";
import { Ecc, Fio } from "@fioprotocol/fiojs";
const { checkEncode, checkDecode } = require("@fioprotocol/fiojs/dist/ecc/key_utils");
import * as secp256k1 from "@secux/utility/lib/secp256k1";
import { sha256 } from "hash.js";
import ow from "ow";
import { SDK, setApiUrl, setSecretHook } from "./transaction";
import { IPlugin, ITransport, staticImplements } from "@secux/transport";


const ow_path = ow_strictPath(235, 44);
const fio_prefix = "FIO";
const ow_fioPubkey = ow.string
    .startsWith(fio_prefix)
    .is(x => !!checkDecode(x.substring(fio_prefix.length)));


@staticImplements<IPlugin>()
export class SecuxFIO {
    /**
     * Convert publickey to FIO address.
     * @param {string|Buffer} publickey secp256k1 publickey
     * @param {boolean} isLegacy
     * @returns {string} address
     */
    static addressConvert(publickey: string | Buffer, isLegacy: boolean = true): string {
        const pk = (typeof publickey === "string") ? Buffer.from(publickey, "hex") : publickey;
        ow(pk, ow.buffer.is(x => secp256k1.validate(x)));

        if (!isLegacy) {
            return "PUB_K1_" + checkEncode(pk, "K1");
        }

        const pubkey = Ecc.PublicKey.fromBuffer(pk);
        return pubkey.toString();
    }

    /**
     * Convert FIO publickey to account name
     * @param {string} pubkey FIO publickey
     * @returns {string} account name
     */
    static accountName(pubkey: string): string {
        ow(pubkey, ow_fioPubkey);
        return Fio.accountHash(pubkey);
    }

    /**
     * Prepare data for address generation.
     * @param {string} path m/44'/235'/...
     * @returns {communicationData} data for sending to device
     */
    static prepareAddress(path: string): communicationData {
        return this.preparePublickey(path);
    }

    /**
     * Resolve address from response data.
     * @param {communicationData} response data from device
     * @param {boolean} isLegacy
     * @returns {string} address
     */
    static resolveAddress(response: communicationData, isLegacy: boolean = true): string {
        ow(response, ow_communicationData);

        const pk = this.resolvePublickey(response);
        return this.addressConvert(pk, isLegacy);
    }

    /**
     * Prepare data for secp256k1 publickey.
     * @param {string} path m/44'/235'/...
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
    static resolvePublickey(response: communicationData): string {
        const pk = SecuxTransactionTool.resolvePublickey(response, EllipticCurve.SECP256K1);
        return Buffer.from(pk, "base64").toString("hex");
    }

    /**
     * Prepare data for xpub generation.
     * @param {string} path m/44'/235'/...
     * @returns {communicationData} data for sending to device
     */
    static prepareXPublickey(path: string): communicationData {
        ow(path, ow_path);
        return SecuxTransactionTool.getXPublickey(path);
    }

    /**
     * Generate xpub with response data.
     * @param {communicationData} response data from device
     * @param {string} path m/44'/235'/...
     * @returns {string} xpub
     */
    static resolveXPublickey(response: communicationData, path: string): string {
        ow(path, ow_path);
        return SecuxTransactionTool.resolveXPublickey(response, path);
    }

    static prepareSharedSecret(path: string, publickey: communicationData): communicationData {
        ow(path, ow_path);
        return SecuxTransactionTool.getECIESsecret(path, publickey);
    }

    static resolveSharedSecret(response: communicationData): communicationData {
        return SecuxTransactionTool.resolveECIESsecret(response);
    }

    /**
     * Prepare data for signing.
     * @param {string} path m/44'/235'/...
     * @param {string} sender sender legacy address
     * @param {Array<any>} args arguments to call FIOSDK
     * @returns {prepared} return object
     */
    static async prepareSign(path: string, sender: string, ...args: any[]): Promise<{ commandData: communicationData, serialized: communicationData }> {
        ow(path, ow_path);
        ow(sender, ow_fioPubkey);

        SDK.publicKey = sender;

        const { compression, packed_context_free_data, packed_trx, sigData } = await SDK.genericAction(...args);
        const tx = Buffer.from(sha256().update(sigData).digest());
        const serialized = Buffer.from(JSON.stringify({
            compression,
            packed_context_free_data,
            packed_trx,
            pubkey: new Ecc.PublicKey(sender).toHex(),
            sigData: sigData.toString("hex")
        }));

        return wrapResult({
            commandData: SecuxTransactionTool.signTransaction(path, tx, { curve: EllipticCurve.SECP256K1_LOW_R }),
            serialized: toCommunicationData(serialized)
        });
    }

    /**
     * Resolve signature from response data
     * @param {communicationData} response data from device
     * @returns {string} FIO signature
     */
    static resolveSignature(response: communicationData): string {
        const sigBuffer = Buffer.from(SecuxTransactionTool.resolveSignature(response), "base64");
        const sig = Signature.fromSignature(sigBuffer);
        sig.flipS(true);

        let i = sig.v[0];
        i += 4;  // compressed
        i += 27; // compact  //  24 or 27 :( forcing odd-y 2nd key candidate)
        const signature = Buffer.from([i, ...sig.r, ...sig.s]);

        return "SIG_K1_" + checkEncode(signature, "K1");
    }

    /**
     * Resolve raw transaction for broadcasting
     * @param {communicationData} response data from device
     * @param {communicationData} serialized 
     * @returns {string} api parameters
     */
    static resolveTransaction(response: communicationData, serialized: communicationData) {
        ow(response, ow_communicationData);
        ow(serialized, ow_communicationData);

        const {
            compression,
            packed_trx,
            packed_context_free_data,
            pubkey, sigData
        } = JSON.parse(getBuffer(serialized).toString());

        const signature = this.resolveSignature(response);

        return wrapResult({
            signatures: [signature],
            compression,
            packed_trx,
            packed_context_free_data
        });
    }

    static async action(transport: ITransport, path: string, ...args: any[]): Promise<any> {
        ow(path, ow_path);

        //@ts-ignore
        setSecretHook(async (pubkey: Buffer) => await transport.getSharedSecret(path, pubkey));

        try {
            SDK.publicKey = await SecuxFIO.getAddress.call(transport, path);
            const result = await SDK.genericAction(...args);

            return result;
        }
        finally {
            setSecretHook(null);
        }
    }

    static async getAddress(this: ITransport, path: string, isLegacy: boolean = true): Promise<string> {
        const data = SecuxFIO.prepareAddress(path);
        const rsp = await this.Exchange(getBuffer(data));
        const address = SecuxFIO.resolveAddress(rsp, isLegacy);

        return address;
    }

    static async getPublickey(this: ITransport, path: string) {
        const data = SecuxFIO.preparePublickey(path);
        const rsp = await this.Exchange(getBuffer(data));
        const publickey = SecuxFIO.resolvePublickey(rsp);

        return publickey;
    }

    static async getXPublickey(this: ITransport, path: string) {
        const data = SecuxFIO.prepareXPublickey(path);
        const rsp = await this.Exchange(getBuffer(data));
        const xpub = SecuxFIO.resolveXPublickey(rsp, path);

        return xpub;
    }

    static async sign(this: ITransport, path: string, ...args: any[]) {
        //@ts-ignore
        setSecretHook(async (pubkey: Buffer) => await this.getSharedSecret(path, pubkey));
        const address = await SecuxFIO.getAddress.call(this, path);

        try {
            const { commandData, serialized } = await SecuxFIO.prepareSign(path, address, ...args);
            const rsp = await this.Exchange(getBuffer(commandData));
            const obj = SecuxFIO.resolveTransaction(rsp, serialized);

            return obj;
        }
        finally {
            setSecretHook(null);
        }
    }

    static set ApiUrl(url: string) {
        setApiUrl(url);
    }
}

loadPlugin(SecuxFIO, "SecuxFIO");


try {
    const { ITransport } = require("@secux/transport");

    Object.defineProperties(ITransport.prototype, {
        fioAction: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (path: string, ...args: any[]) {
                const response = await SecuxFIO.action(this, path, ...args);
                if (response.sigData?.length > 0) {
                    throw Error(`Fio action need to be signed. (${args[0]})`);
                }

                return response;
            }
        },
    });
} catch (error) {
    // skip plugin injection 
}