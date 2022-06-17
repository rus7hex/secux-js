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
import { bech32 } from "bech32";
import { ripemd160, sha256 } from "hash.js";
import { SecuxTransactionTool } from "@secux/protocol-transaction";
import { EllipticCurve } from "@secux/protocol-transaction/lib/interface";
import { loadPlugin, owTool, Signature } from "@secux/utility";
import { IPlugin, ITransport, staticImplements } from "@secux/transport";
import { communicationData, getBuffer, ow_communicationData, wrapResult } from "@secux/utility/lib/communication";
import ow from "ow";
import {
    AddressType, IMessage, Network, ow_AddressType, ow_IMessage, ow_path, ow_Signer, ow_TxOption, Signer, TxOption
} from "./interface";
import { Fee, Transaction } from "./tx";
import { CW20 } from "./cw-20";


const AminoPrefixSecp256k1 = Buffer.from([0xeb, 0x5a, 0xe9, 0x87, 0x21]);


/**
 * LUNA package for SecuX device
 */
@staticImplements<IPlugin>()
export class SecuxLUNA {
    static readonly AddressType = AddressType;
    static readonly Network = Network;
    static readonly CW20 = CW20;

    /**
     * Convert secp256k1 publickey to LUNA address.
     * @param {string|Buffer} publickey secp256k1 publickey
     * @param {AddressType} type account/validator/pubkey address
     * @returns {string} LUNA address
     */
    static addressConvert(publickey: string | Buffer, type: AddressType): string {
        ow(type, ow_AddressType);

        const pk = getPublickey(publickey);
        let rawAddress = sha256().update(pk).digest();
        rawAddress = ripemd160().update(rawAddress).digest();

        switch (type) {
            case AddressType.validator:
                return bech32.encode("terravaloper", bech32.toWords(rawAddress));

            case AddressType.pubkey:
                return bech32.encode("terrapub", bech32.toWords(
                    Buffer.concat([AminoPrefixSecp256k1, pk])
                ));

            default:
                return bech32.encode("terra", bech32.toWords(rawAddress));
        }
    }

    /**
     * Prepare data for address generation.
     * @param {string} path BIP32 path, ex: m/44'/330'/0'/0/0
     * @returns {communicationData} data for sending to device
     */
    static prepareAddress(path: string): communicationData {
        return this.preparePublickey(path);
    }

    /**
     * Generate address from response data.
     * @param {communicationData} response data from device
     * @param {AddressType} type account/validator/pubkey address
     * @returns {string} LUNA address
     */
    static resolveAddress(response: communicationData, type: AddressType = AddressType.account): string {
        ow(response, ow_communicationData);

        const publickey = this.resolvePublickey(response);
        return this.addressConvert(publickey, type);
    }

    /**
     * Prepare data for secp256k1 publickey.
     * @param {string} path BIP32 path, ex: m/44'/330'/0'/0/0
     * @returns {communicationData} data for sending to device
     */
    static preparePublickey(path: string): communicationData {
        ow(path, ow_path);

        return SecuxTransactionTool.getPublickey(path, EllipticCurve.SECP256K1);
    }

    /**
     * Resolve secp256k1 publickey from response data.
     * @param {communicationData} response data from device
     * @returns {string} secp256k1 publickey (base64-encoded string)
     */
    static resolvePublickey(response: communicationData): string {
        return SecuxTransactionTool.resolvePublickey(response, EllipticCurve.SECP256K1);
    }

    /**
     * Prepare data for xpub.
     * @param {string} path BIP32 path, ex: m/44'/330'/0'/0/0
     * @returns {communicationData} data for sending to device
     */
    static prepareXPublickey(path: string) {
        ow(path, ow_path);

        return SecuxTransactionTool.getXPublickey(path, EllipticCurve.SECP256K1);
    }

    /**
     * Resolve xpub from response data.
     * @param {communicationData} response data from device
     * @param {string} path BIP32 path, ex: m/44'/330'/0'/0/0
     * @returns {string} xpub
     */
    static resolveXPublickey(response: communicationData, path: string): string {
        ow(path, ow_path);

        return SecuxTransactionTool.resolveXPublickey(response, path);
    }

    /**
     * Prepare data for signing.
     * @param {Signer} signers array of signer
     * @param {Array<IMessage>} messages each message represents a instruction
     * @param {TxOption} params
     * @returns {prepared}
     */
    static prepareSign(signers: Array<Signer>, messages: Array<IMessage>, params: TxOption)
        : { commands: Array<communicationData>, serialized: communicationData } {
        ow(signers, ow.array.ofType(ow_Signer));
        ow(messages, ow.array.ofType(ow_IMessage));
        ow(params, ow.any(ow_TxOption, ow.undefined));

        // check secp256k1 publickey
        for (const signer of signers) {
            getPublickey(signer.publickey);
        }

        const _fee = new Fee(params.gasLimit, params.fee, params.payer, params.granter);
        return wrapResult(
            Transaction.create(signers, messages, _fee, params)
        );
    }

    /**
     * Reslove signature from response data.
     * @param {communicationData} response data from device
     * @returns {Array<string>} signature array of base64-encoded string
     */
    static resolveSignatureList(response: communicationData): Array<string> {
        const sigBufList = SecuxTransactionTool.resolveSignatureList(response).map(x => Buffer.from(x, "base64"));
        const sigList = sigBufList.map(x => Signature.fromSignature(x));

        return sigList.map(x => Buffer.concat([x.r, x.s]).toString("base64"));
    }

    /**
     * Serialize transaction wtih signature for broadcasting.
     * @param {communicationData|Array<communicationData>} response data from device
     * @param {communicationData} serialized
     * @returns {string} signed raw transaction
     */
    static resolveTransaction(response: communicationData | Array<communicationData>, serialized: communicationData): string {
        ow(response, ow.any(ow_communicationData, ow.array.ofType(ow_communicationData)));
        ow(serialized, ow_communicationData);

        response = Array.isArray(response) ? response : [response];
        const signatures: Array<string> = [];
        for (const rsp of response) {
            const sigList = this.resolveSignatureList(rsp);
            signatures.push(...sigList);
        }

        return Transaction.finalize(serialized, signatures);
    }

    /**
     * Simulate a transaction for estimating gas.
     * @param {Array<Signer>} signers array of signer
     * @param {Array<IMessage>} messages each message represents a instruction
     * @param {TxOption} [params] 
     * @returns {string} simulated transaction
     */
    static simulate(signers: Array<Signer>, messages: Array<IMessage>, params?: TxOption): string {
        ow(signers, ow.array.ofType(
            ow.object.partialShape({
                sequence: ow.number.uint32,
            })
        ));
        ow(messages, ow.array.ofType(ow_IMessage));

        return Transaction.simulate(signers, messages, params);
    }

    static async getAddress(this: ITransport, path: string, type: AddressType): Promise<string> {
        const data = SecuxLUNA.prepareAddress(path);
        const rsp = await this.Exchange(getBuffer(data));
        const address = SecuxLUNA.resolveAddress(rsp, type);

        return address;
    }

    static async getPublickey(this: ITransport, path: string) {
        const data = SecuxLUNA.preparePublickey(path);
        const rsp = await this.Exchange(getBuffer(data));
        const publickey = SecuxLUNA.resolvePublickey(rsp);

        return publickey;
    }

    static async getXPublickey(this: ITransport, path: string) {
        const data = SecuxLUNA.prepareXPublickey(path);
        const rsp = await this.Exchange(getBuffer(data));
        const xpub = SecuxLUNA.resolveXPublickey(rsp, path);

        return xpub;
    }

    static async sign(this: ITransport, signers: Array<Signer>, messages: Array<IMessage>, params: TxOption) {
        for (const signer of signers) {
            if (!signer.publickey) {
                signer.publickey = await SecuxLUNA.getPublickey.call(this, signer.path);
            }
        }

        const { commands, serialized } = SecuxLUNA.prepareSign(signers, messages, params);
        return {
            multi_command: commands,
            serialized
        }
    }
}

import * as msg from "./msg";
const map: any = {};
Object.keys(msg).forEach(x => map[x] = {
    enumerable: true,
    configurable: false,
    writable: false,
    value: (msg as any)[x]
});
Object.defineProperties(SecuxLUNA, map);

loadPlugin(SecuxLUNA, "SecuxLUNA");


function getPublickey(data: string | Buffer) {
    ow(data, ow.any(owTool.base64String, ow.buffer));

    const pk = (typeof data === "string") ? Buffer.from(data, "base64") : data;
    ow(pk, ow.buffer.is(x => x.length === 33 || x.length === 65));

    if (!secp256k1.publicKeyVerify(pk)) {
        throw Error(`ArgumentError: invalid secp256k1 publickey, got "${pk.toString("hex")}"`);
    }

    return pk;
}


/**
 * Data type for transmission.
 * @typedef {string | Buffer} communicationData
 */

/**
 * Address Type.
 * @typedef {enum} AddressType
 * @property {string} account account
 * @property {string} validator validator
 * @property {string} pubkey pubkey
 */

/**
 * The account to sign a transaction.
 * @typedef {object} Signer
 * @property {string} path BIP32 path, ex: m/44'/330'/0'/0/0
 * @property {string | Buffer} publickey secp256k1 publickey from `path`
 * @property {number} sequence the number of transactions sent from this address
 * @property {number} accountNumber the account number from blockchain
 */

/**
 * Message interface definition.
 * @typedef {interface} IMessage
 * @property {function} toAmino
 * @property {function} toData
 * @property {function} toProto
 * @property {function} packAny
 */

/**
 * Transaction configuration.
 * @typedef {object} TxOption
 * @property {string | Coins} fee the amount of coins to be paid as a fee
 * @property {number} gasLimit the maximum gas that can be used in transaction processing
 * @property {string} [chainId] blockchain network identifier
 * @property {string} [memo]
 * @property {string} [timeoutHeight] timeout height relative to the current block height
 * @property {string} [payer] payer’s account address
 * @property {string} [granter] granter’s account address
 */

/**
 * Object for the signing and validation.
 * @typedef {object} prepared
 * @property {Array<communicationData>} commands data for sending to device
 * @property {communicationData} serialized unsigned raw transaction
 */
