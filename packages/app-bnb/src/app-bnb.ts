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


const secp256k1 = require('secp256k1/elliptic');
import { crypto, Transaction, types } from "@binance-chain/javascript-sdk";
import { IPlugin, ITransport, staticImplements } from '@secux/transport';
import { loadPlugin, owTool, ow_strictPath, Signature } from '@secux/utility';
import { communicationData, getBuffer, ow_communicationData, toCommunicationData, wrapResult } from "@secux/utility/lib/communication";
import { SecuxTransactionTool } from "@secux/protocol-transaction";
import { EllipticCurve } from "@secux/protocol-transaction/lib/interface";
import ow from 'ow';
import { txDetail, ow_txDetail } from './interface';
export { SecuxBNB, txDetail };


const ow_path = ow_strictPath(714, 44);


/**
 * BNB package for SecuX device
 */
@staticImplements<IPlugin>()
class SecuxBNB {
    /**
     * Convert secp256k1 publickey to BNB address.
     * @param {string|Buffer} publickey secp256k1 publickey
     * @returns {string} BNB address
     */
    static addressConvert(publickey: string | Buffer): string {
        const pk = validatePublickey(publickey);

        return crypto.getAddressFromPublicKey(pk.toString('hex'), 'bnb');
    }

    /**
     * Prepare data for address generation.
     * @param {string} path m/44'/714'/...
     * @returns {communicationData} data for sending to device
     */
    static prepareAddress(path: string): communicationData {
        return this.preparePublickey(path);
    }

    /**
     * Generate address from response data.
     * @param {communicationData} response data from device
     * @returns {string} BNB address
     */
    static resolveAddress(response: communicationData): string {
        ow(response, ow_communicationData);

        const publickey = SecuxBNB.resolvePublickey(response);
        return SecuxBNB.addressConvert(publickey);
    }

    /**
     * Prepare data for secp256k1 publickey.
     * @param {string} path m/44'/714'/...
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
        return Buffer.from(
            SecuxTransactionTool.resolvePublickey(response, EllipticCurve.SECP256K1),
            "base64"
        ).toString("hex");
    }

    /**
     * Prepare data for xpub.
     * @param {string} path m/44'/714'/...
     * @returns {communicationData} data for sending to device
     */
    static prepareXPublickey(path: string) {
        ow(path, ow_path);

        return SecuxTransactionTool.getXPublickey(path);
    }

    /**
     * Resolve xpub from response data.
     * @param {communicationData} response data from device
     * @param {string} path m/44'/714'/...
     * @returns {string} xpub
     */
    static resolveXPublickey(response: communicationData, path: string) {
        ow(path, ow_path);

        return SecuxTransactionTool.resolveXPublickey(response, path);
    }

    /**
     * Prepare data for signing.
     * @param {string} path m/44'/714'/...
     * @param {txDetail} content transaction object
     * @returns {prepared} return object
     */
    static prepareSign(path: string, content: txDetail): { commandData: communicationData, serialized: communicationData } {
        ow(path, ow_path);
        ow(content, ow_txDetail);

        const tx = CreateTransaction(content).getSignBytes();

        return wrapResult({
            commandData: SecuxTransactionTool.signRawTransaction(path, tx),
            serialized: toCommunicationData(Buffer.from(JSON.stringify(content)))
        });
    }

    /**
     * Resolve signature from response data
     * @param {communicationData} response data from device
     * @returns {string} signature (hex string)
     */
    static resolveSignature(response: communicationData) {
        const sigBuffer = Buffer.from(SecuxTransactionTool.resolveSignature(response), "base64");
        const sig = Signature.fromSignature(sigBuffer);

        return Buffer.concat([sig.r, sig.s]).toString("hex");
    }

    /**
     * Resolve raw transaction for broadcasting
     * @param {communicationData} response data from device
     * @param {communicationData} serialized 
     * @returns {string} signed raw transaction
     */
    static resolveTransaction(response: communicationData, serialized: communicationData) {
        ow(response, ow_communicationData);
        ow(serialized, ow_communicationData);

        const content: txDetail = JSON.parse(getBuffer(serialized).toString());
        const tx = CreateTransaction(content);

        const signature = Buffer.from(SecuxBNB.resolveSignature(response), "hex");
        const pk = validatePublickey(content.publickey!);
        const signed = tx.addSignature(crypto.getPublicKey(pk.toString("hex")), signature);

        return signed.serialize();
    }


    static async getAddress(this: ITransport, path: string): Promise<string> {
        const data = SecuxBNB.prepareAddress(path);
        const rsp = await this.Exchange(getBuffer(data));
        const address = SecuxBNB.resolveAddress(rsp);

        return address;
    }

    static async getPublickey(this: ITransport, path: string) {
        const data = SecuxBNB.preparePublickey(path);
        const rsp = await this.Exchange(getBuffer(data));
        const publickey = SecuxBNB.resolvePublickey(rsp);

        return publickey;
    }

    static async getXPublickey(this: ITransport, path: string) {
        const data = SecuxBNB.prepareXPublickey(path);
        const rsp = await this.Exchange(getBuffer(data));
        const xpub = SecuxBNB.resolveXPublickey(rsp, path);

        return xpub;
    }

    static async sign(this: ITransport, path: string, content: txDetail) {
        content.publickey = await SecuxBNB.getPublickey.call(this, path);

        const { commandData, serialized } = SecuxBNB.prepareSign(path, content);
        const rsp = await this.Exchange(getBuffer(commandData));
        const raw_tx = SecuxBNB.resolveTransaction(rsp, serialized);
        const signature = SecuxBNB.resolveSignature(rsp);

        return {
            raw_tx,
            signature
        }
    }
}

loadPlugin(SecuxBNB, "SecuxBNB");


function validatePublickey(data: string | Buffer): Buffer {
    ow(data, ow.any(owTool.hexString, ow.buffer));

    const pk = (typeof data === "string") ? Buffer.from(data, "hex") : data;
    if (!secp256k1.publicKeyVerify(pk)) {
        throw Error(`ArgumentError: invalid secp256k1 publickey, got "${pk.toString("hex")}"`);
    }

    return pk;
}

function CreateTransaction(content: txDetail) {
    const pk = validatePublickey(content.publickey!);
    const from = SecuxBNB.addressConvert(pk);

    const sendMsg = new types.SendMsg(from, [
        {
            address: content.to,
            coins: [
                {
                    denom: "BNB",
                    amount: content.amount
                }
            ]
        }
    ]);

    const obj = {
        chainId: content.chainId ?? "Binance-Chain-Tigris",
        accountNumber: content.accountNumber ?? 0,
        sequence: content.sequence ?? 0,
        baseMsg: sendMsg,
        memo: content.memo ?? '',
        source: 1
    };

    return new Transaction(obj);
}


/**
 * Data type for transmission.
 * @typedef {string|Buffer} communicationData
 */

/**
 * The payment object.
 * @typedef {object} txDetail
 * @property {string|Buffer} publickey sender's publickey
 * @property {string} to receiving address
 * @property {number} amount BNB has 8 decimals
 * @property {string} [chainId] use specific BNB network
 * @property {number} [accountNumber] for replay protection
 * @property {number} [sequence] for replay protection
 * @property {string} [memo] 
 */

/**
 * Object for the signing and validation.
 * @typedef {object} prepared
 * @property {communicationData} commandData data for sending to device
 * @property {communicationData} serialized
 */