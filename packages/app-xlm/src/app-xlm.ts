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


import {
    StrKey, Account, Memo, TransactionBuilder, Operation, Asset, TimeoutInfinite, Keypair, xdr, Networks
} from 'stellar-base';
import ow from "ow";
import { IPlugin, ITransport, staticImplements } from "@secux/transport";
import { SecuxTransactionTool } from "@secux/protocol-transaction";
import { EllipticCurve, TransactionType } from "@secux/protocol-transaction/lib/interface";
import { ow_bip32Path, ow_txDetail, txDetail } from './interface';
import { loadPlugin, owTool, Signature } from "@secux/utility";
import { communicationData, getBuffer, ow_communicationData, toCommunicationData, wrapResult } from "@secux/utility/lib/communication";
export { SecuxXLM };


/**
 * XLM package for SecuX device
 */
@staticImplements<IPlugin>()
class SecuxXLM {
    /**
     * Convert ED25519 publickey to XLM address.
     * @param {string|Buffer} publickey ed25519 publickey
     * @returns {string} XLM address
     */
    static addressConvert(publickey: string | Buffer): string {
        ow(publickey, ow.any(owTool.hexString, ow.buffer));

        const pk = (typeof publickey === "string") ? Buffer.from(publickey, "hex") : publickey;
        return StrKey.encodeEd25519PublicKey(pk);
    }

    /**
     * Prepare data for XLM address.
     * @param {string} path BIP32 path (hardened child key), ex: m/44'/148'/0'
     * @returns {communicationData} data for sending to device
     */
    static prepareAddress(path: string): communicationData {
        return this.preparePublickey(path);
    }

    /**
     * Generate XLM address from response data.
     * @param {communicationData} response data from device
     * @returns {string} XLM address
     */
    static resolveAddress(response: communicationData): string {
        const pk = SecuxXLM.resolvePublickey(response);
        return SecuxXLM.addressConvert(pk);
    }

    /**
     * Prepare data for ed25519 publickey.
     * @param {string} path BIP32 path (hardened child key), ex: m/44'/148'/0'
     * @returns {communicationData} data for sending to device
     */
    static preparePublickey(path: string): communicationData {
        ow(path, ow_bip32Path);
        return SecuxTransactionTool.getPublickey(path, EllipticCurve.ED25519);
    }

    /**
     * Resove ed25519 publickey from response data.
     * @param {communicationData} response data from device
     * @returns {string} ed25519 publickey (hex string)
     */
    static resolvePublickey(response: communicationData): string {
        const pk = Buffer.from(SecuxTransactionTool.resolvePublickey(response, EllipticCurve.ED25519), "base64");
        return pk.toString("hex");
    }

    /**
     * Prepare data for signing.
     * @param {string} path BIP32 path (hardened child key), ex: m/44'/148'/0'
     * @param {txDetail} content transaction object
     * @returns {prepared} prepared object
     */
    static prepareSign(path: string, content: txDetail): { commandData: communicationData, serialized: communicationData } {
        ow(path, ow_bip32Path);
        ow(content, ow_txDetail);

        if (!content.networkPassphrase) content.networkPassphrase = Networks.PUBLIC;

        const operation = (!content.needCreateAccount) ?
            Operation.payment({
                destination: content.to,
                asset: Asset.native(),
                amount: content.amount
            })
            :
            Operation.createAccount({
                destination: content.to,
                startingBalance: content.amount
            });

        const transaction = CreateTransaction(content.from, operation, content);
        const data = transaction.signatureBase();

        const commandData = SecuxTransactionTool.signRawTransaction(path, data, {
            tp: TransactionType.NORMAL,
            curve: EllipticCurve.ED25519,
            chainId: 0
        });
        const xdr = transaction.toXDR();

        return wrapResult({
            commandData,
            serialized: toCommunicationData(Buffer.from(JSON.stringify({ xdr, from: content.from })))
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

        return Buffer.concat([sig.r, sig.s]).toString("hex");
    }

    /**
     * Generate raw transaction for broadcasting.
     * @param {communicationData} response data from device
     * @param {communicationData} serialized serialized object
     * @returns {string} signed raw transaction
     */
    static resolveTransaction(response: communicationData, serialized: communicationData) {
        ow(serialized, ow_communicationData);

        const json = JSON.parse(getBuffer(serialized).toString());

        const keyPair = Keypair.fromPublicKey(json.from);
        const hint = keyPair.signatureHint();
        const decorated = new xdr.DecoratedSignature({
            hint,
            signature: Buffer.from(SecuxXLM.resolveSignature(response), "hex")
        });

        const tx = TransactionBuilder.fromXDR(json.xdr, Networks.PUBLIC);
        tx.signatures.push(decorated);

        return tx.toEnvelope().toXDR("base64");
    }

    static async getAddress(this: ITransport, path: string) {
        const data = SecuxXLM.prepareAddress(path);
        const rsp = await this.Exchange(getBuffer(data));
        const address = SecuxXLM.resolveAddress(rsp);

        return address;
    }

    static async getPublickey(this: ITransport, path: string) {
        const data = SecuxXLM.preparePublickey(path);
        const rsp = await this.Exchange(getBuffer(data));
        const publickey = SecuxXLM.resolvePublickey(rsp);

        return publickey;
    }

    static async getXPublickey(this: ITransport, path: string): Promise<string> {
        throw Error("Stellar(XLM) do not support xpub.");
    }

    static async sign(this: ITransport, path: string, content: txDetail) {
        const from = await SecuxXLM.getAddress.call(this, path);
        const { commandData, serialized } = SecuxXLM.prepareSign(path, { ...content, from });
        const rsp = await this.Exchange(getBuffer(commandData));
        const signature = SecuxXLM.resolveSignature(rsp);
        const raw_tx = SecuxXLM.resolveTransaction(rsp, serialized);

        return { raw_tx, signature };
    }
}

loadPlugin(SecuxXLM, "SecuxXLM");


function CreateTransaction(from: string, operation: xdr.Operation, content: txDetail) {
    const stellarAccount = new Account(from, content.sequence.toString(10));

    let memo;
    if (content.memo) memo = Memo[content.memo.Type](content.memo.Value);

    const transaction = new TransactionBuilder(stellarAccount, {
        fee: content.fee.toString(10),
        networkPassphrase: content.networkPassphrase,
        memo
    })
        .addOperation(operation)
        .setTimeout(TimeoutInfinite)
        .build();

    return transaction;
}


/**
 * Data type for transmission.
 * @typedef {string|Buffer} communicationData
 */

/**
 * The payment object.
 * @typedef {object} txDetail
 * @property {string} from sending address
 * @property {string} to receiving address
 * @property {string} amount transfer amount
 * @property {string | number} sequence 
 * @property {string | number} fee 
 * @property {memoObj} [memo] 
 * @property {string} [networkPassphrase] network for XLM, default is mainnet
 * @property {boolean} [needCreateAccount] pay for creating new account, default: false
 */

/**
 * Memo.
 * @typedef {object} memoObj
 * @property {string} Type MemoType
 * @property {string} Value
 */

/**
 * Object for the signing and validation.
 * @typedef {object} prepared
 * @property {communicationData} commandData data for sending to device
 * @property {communicationData} serialized serialized object
 */