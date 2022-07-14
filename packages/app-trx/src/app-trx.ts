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


import { keccak256 } from "@ethersproject/keccak256";
import { sha256 } from "hash.js";
import * as bs58 from 'base-x';
const TransactionUtils = require("@tronscan/client/src/utils/transactionBuilder");
const { TriggerSmartContract, TransferContract, TransferAssetContract } = require("@tronscan/client/src/protocol/core/Contract_pb");
const { Transaction } = require("@tronscan/client/src/protocol/core/Tron_pb");
const secp256k1 = require('secp256k1/elliptic');
import ow from "ow";
import { IPlugin, ITransport, staticImplements } from '@secux/transport';
import { communicationData, getBuffer, ow_communicationData, toCommunicationData, wrapResult } from "@secux/utility/lib/communication";
import { SecuxTransactionTool } from "@secux/protocol-transaction";
import { EllipticCurve } from "@secux/protocol-transaction/lib/interface";
import { ow_transferData, ow_trc10_Data, ow_trc20_Data, txDetail, transferData, trc10_Data, trc20_Data } from './interface';
import { isTransfer, isTrc10Data, isTrc20Data } from "./utils";
import { BigIntToBuffer, loadPlugin, Logger, owTool, ow_strictPath, Signature } from "@secux/utility";
export { SecuxTRX, transferData, trc10_Data, trc20_Data };
const logger = Logger?.child({ id: "trx" });

const Base58 = bs58('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz');
const ADDRESS_PREFIX = 0x41;
const ADDRESS_PREFIX_REGEX = new RegExp(`^${ADDRESS_PREFIX.toString(16)}`);
const MAX_EXPIRATION_DURATION = 24 * 60 * 60 * 1000 - 1;
const ow_path = ow_strictPath(195, 44);


/**
 * TRX package for SecuX device
 */
@staticImplements<IPlugin>()
class SecuxTRX {
    /**
     * Convert secp256k1 publickey to TRX address.
     * @param {string|Buffer} publickey 
     * @returns {string} TRX address
     */
    static addressConvert(publickey: string | Buffer): string {
        let pk = getPublickey(publickey);
        pk = pk.slice(1);

        const keccak = Buffer.from(keccak256(pk).slice(2), 'hex').slice(-20);
        const address = bs58Encode(keccak, ADDRESS_PREFIX);

        return address;
    }

    /**
     * Convert TRX address to hex representation
     * @param {string} address TRX address
     * @returns {string} TRX address (hex)
     */
    static toHexAddress(address: string): string {
        ow(address, ow.string);

        return addressToHex(address);
    }

    /**
     * Prepare data for address generation.
     * @param {string} path m/44'/195'/...
     * @returns {communicationData} data for sending to device
     */
    static prepareAddress(path: string) {
        return this.preparePublickey(path);
    }

    /**
     * Generate address from response data.
     * @param {communicationData} response data from device
     * @returns {string} TRX address
     */
    static resolveAddress(response: communicationData) {
        const pk = SecuxTRX.resolvePublickey(response);
        return SecuxTRX.addressConvert(pk);
    }

    /**
     * Prepare data for secp256k1 publickey.
     * @param {string} path m/44'/195'/...
     * @returns {communicationData} data for sending to device
     */
    static preparePublickey(path: string) {
        ow(path, ow_path);

        return SecuxTransactionTool.getPublickey(path, EllipticCurve.SECP256K1);
    }

    /**
     * Resolve secp256k1 publickey from response data.
     * @param {communicationData} response data from device
     * @returns {string} secp256k1 publickey
     */
    static resolvePublickey(response: communicationData) {
        const pk = SecuxTransactionTool.resolvePublickey(response, EllipticCurve.SECP256K1, false);
        return Buffer.from(pk, "base64").toString("hex");
    }

    /**
     * Prepare data for xpub.
     * @param {string} path m/44'/195'/...
     * @returns {communicationData} data for sending to device
     */
    static prepareXPublickey(path: string) {
        ow(path, ow_path);
        return SecuxTransactionTool.getXPublickey(path);
    }

    /**
     * Resolve xpub from response data.
     * @param {communicationData} response data from device
     * @param {string} path m/44'/195'/...
     * @returns xpub
     */
    static resolveXPublickey(response: communicationData, path: string) {
        ow(path, ow_path);
        return SecuxTransactionTool.resolveXPublickey(response, path);
    }

    /**
     * Prepare data for signing.
     * @param {string} path m/44'/195'/...
     * @param {transferData | trc10_Data | trc20_Data} content transaction object
     * @returns {prepared} prepared object
     */
    static prepareSign(path: string, content: txDetail): { commandData: communicationData, rawTx: communicationData } {
        ow(path, ow_path);
        ow(content, ow.any(ow_transferData, ow_trc10_Data, ow_trc20_Data));

        let builder, tmp;
        if ((tmp = isTransfer(content))) {
            logger?.debug("transfer contract");

            const contract = new TransferContract();
            contract.setToAddress(new Uint8Array(bs58Decode(tmp.to)));
            contract.setOwnerAddress(new Uint8Array(bs58Decode(tmp.from!)));
            contract.setAmount(tmp.amount);

            builder = TransactionUtils.buildTransferContract(contract, Transaction.Contract.ContractType.TRANSFERCONTRACT, "TransferContract");
        }
        else if ((tmp = isTrc10Data(content))) {
            logger?.debug("trc10 contract");

            const contract = new TransferAssetContract();
            contract.setToAddress(new Uint8Array(bs58Decode(tmp.to)));
            contract.setOwnerAddress(new Uint8Array(bs58Decode(tmp.from!)));
            contract.setAmount(tmp.amount);
            contract.setAssetName(new Uint8Array(Buffer.from(tmp.token.toString(10))));

            builder = TransactionUtils.buildTransferContract(contract, Transaction.Contract.ContractType.TRANSFERASSETCONTRACT, "TransferAssetContract");
        }
        else if ((tmp = isTrc20Data(content))) {
            logger?.debug("trc20 contract");

            const contract = new TriggerSmartContract();
            contract.setOwnerAddress(new Uint8Array(bs58Decode(tmp.from!)));
            contract.setContractAddress(new Uint8Array(bs58Decode(tmp.contract)));
            if (tmp.tokenId) contract.setTokenId(tmp.tokenId);
            if (tmp.tokenValue) contract.setCallTokenValue(tmp.tokenValue);
            if (tmp.callValue) contract.setCallValue(tmp.callValue);

            if (tmp.data) {
                contract.setData(Buffer.from(tmp.data, "hex"));
            }
            else {
                if (!tmp.to) throw Error(`ArgumentError: missing receiving address.`);
                if (!tmp.amount) throw Error(`ArgumentError: missing sending amount.`);

                contract.setData(encodeABI(tmp.to, tmp.amount));
            }

            builder = TransactionUtils.buildTransferContract(contract, Transaction.Contract.ContractType.TRIGGERSMARTCONTRACT, "TriggerSmartContract");
        }
        logger?.debug("builder created");

        const raw = builder.getRawData();

        raw.setRefBlockHash(Buffer.from(content.blockID.slice(16, 32), "hex"));
        const blockBytes = Buffer.alloc(2);
        blockBytes.writeUInt16BE(content.blockNumber & 0xffff);
        raw.setRefBlockBytes(blockBytes);

        if (content.feeLimit !== undefined) raw.setFeeLimit(content.feeLimit);
        raw.setTimestamp(content.timestamp);
        const expire = content.expiration ?? content.timestamp + MAX_EXPIRATION_DURATION;
        if (expire <= content.timestamp) throw Error(`ArgumentError: timestamp greater than expiration time.`);
        raw.setExpiration(expire);

        const rawTx = Buffer.from(raw.serializeBinary());

        return wrapResult({
            commandData: SecuxTransactionTool.signRawTransaction(path, rawTx),
            rawTx: toCommunicationData(Buffer.from(rawTx))
        });
    }

    /**
     * Resolve signature from response data.
     * @param {communicationData} response data from device
     * @returns {string} signature (hex string)
     */
    static resolveSignature(response: communicationData): string {
        const sig = SecuxTransactionTool.resolveSignature(response);
        const signature = Signature.fromSignature(Buffer.from(sig, "base64"));
        signature.flipS(true);

        return Buffer.concat([signature.r, signature.s, signature.v]).toString("hex");
    }

    /**
     * Resolve transaction for broadcasting.
     * @param {communicationData} response data from device
     * @param {communicationData} serialized raw transaction
     * @returns {string} signed raw transaction
     */
    static resolveTransaction(response: communicationData, serialized: communicationData) {
        ow(response, ow_communicationData);
        ow(serialized, ow_communicationData);

        const signature = Buffer.from(SecuxTRX.resolveSignature(response), "hex");
        logger?.debug(`signature: ${signature.toString("hex")}`);

        const builder = new Transaction();
        const raw = Transaction.raw.deserializeBinary(getBuffer(serialized));
        builder.setRawData(raw);
        for (let i = 0; i < raw.getContractList().length; i++) {
            builder.addSignature(signature);
        }

        const raw_tx = Buffer.from(builder.serializeBinary()).toString("hex");

        return raw_tx;
    }

    static async getAddress(this: ITransport, path: string) {
        const data = SecuxTRX.prepareAddress(path);
        const rsp = await this.Exchange(getBuffer(data));
        const address = SecuxTRX.resolveAddress(rsp);

        return address;
    }

    static async getPublickey(this: ITransport, path: string) {
        const data = SecuxTRX.preparePublickey(path);
        const rsp = await this.Exchange(getBuffer(data));
        const pk = SecuxTRX.resolvePublickey(rsp);

        return pk;
    }

    static async getXPublickey(this: ITransport, path: string) {
        const data = SecuxTRX.prepareXPublickey(path);
        const rsp = await this.Exchange(getBuffer(data));
        const xpub = SecuxTRX.resolveXPublickey(rsp, path);

        return xpub;
    }

    static async sign(this: ITransport, path: string, content: txDetail) {
        ow(path, ow_path);

        if (!content.from) content.from = await SecuxTRX.getAddress.call(this, path);

        const { commandData, rawTx } = SecuxTRX.prepareSign(path, content);
        const rsp = await this.Exchange(getBuffer(commandData));
        const raw_tx = SecuxTRX.resolveTransaction(rsp, rawTx);
        const signature = SecuxTRX.resolveSignature(rsp);

        return {
            raw_tx,
            signature
        }
    }
}

loadPlugin(SecuxTRX, "SecuxTRX");


function encodeABI(toAddress: string, amount: number | string): Buffer {
    // trc20 transfer
    const toBuffer = Buffer.from(addressToHex(toAddress).slice(2).padStart(64, '0'), "hex");
    const amountBuffer = BigIntToBuffer(amount, 32, false);

    return Buffer.from([
        0xa9, 0x05, 0x9c, 0xbb,
        ...toBuffer,
        ...amountBuffer
    ]);
}

function addressToHex(address: string): string {
    if (address.startsWith("T")) {
        return bs58Decode(address).toString("hex");
    }
    else if (address.match(new RegExp(`^${ADDRESS_PREFIX.toString(16)}[0-9a-fA-F]+$`))) {
        return address;
    }

    throw Error(`Invalid Tron Address: ${address}`);
}

function Sha256(data: Uint8Array) {
    return Buffer.from(sha256().update(data).digest());
}

function Sha256Double(data: Uint8Array) {
    const checksumHash1 = sha256().update(data).digest();
    const checksumHash2 = sha256().update(checksumHash1).digest();

    return Buffer.from(checksumHash2);
}

function bs58Encode(hash: Buffer, prefix?: number) {
    const data = (prefix) ? Buffer.concat([Buffer.from([prefix]), hash]) : hash;

    // FIXME: need to find a more flexible solution...
    const hashForChecksum = Sha256Double(data);

    const checksum = hashForChecksum.slice(0, 4);
    const dataToEncode = Buffer.concat([data, checksum]);
    const address = Base58.encode(dataToEncode);

    return address;
}

function bs58Decode(address: string) {
    var decodeCheck = Base58.decode(address);
    if (decodeCheck.length <= 4) {
        logger?.warn(`base58 decode error, address: ${address}`);

        throw Error("base58 decode error");
    }

    var decodeData = decodeCheck.slice(0, decodeCheck.length - 4);
    var hash0 = Sha256(decodeData);
    var hash1 = Sha256(hash0);

    if (hash1[0] === decodeCheck[decodeData.length] &&
        hash1[1] === decodeCheck[decodeData.length + 1] &&
        hash1[2] === decodeCheck[decodeData.length + 2] &&
        hash1[3] === decodeCheck[decodeData.length + 3]) {
        return decodeData;
    }

    throw Error("base58 check error");
}

function getPublickey(data: string | Buffer) {
    ow(data, ow.any(owTool.hexString, ow.buffer));

    let pk = (typeof data === "string") ? Buffer.from(data, "hex") : data;
    if (!secp256k1.publicKeyVerify(pk)) throw Error(`ArgumentError: invalid secp256k1 publickey, got "${pk.toString("hex")}"`);

    pk = secp256k1.publicKeyConvert(pk, false);

    return pk;
}


/**
 * Data type for transmission.
 * @typedef {string|Buffer} communicationData
 */

/**
 * The payment object.
 * @typedef {object} transferData 
 * @property {string} from sending address
 * @property {string} to receiving address
 * @property {number} amount transfer amount
 * @property {string} blockID
 * @property {number} blockNumber
 * @property {number} timestamp
 * @property {number} [feeLimit]
 * @property {number} [expiration]
 */

/**
 * The payment object for TRC-10.
 * @typedef {object} trc10_Data
 * @property {string} from sending address
 * @property {string} to receiving address
 * @property {string | number} token token id number
 * @property {number} amount transfer amount
 * @property {string} blockID
 * @property {number} blockNumber
 * @property {number} timestamp
 * @property {number} [feeLimit]
 * @property {number} [expiration]
 */

/**
 * The payment object for TRC-20.
 * @typedef {object} trc20_Data trc20 object
 * @property {string} from sending address
 * @property {string} to receiving address
 * @property {number | string} amount transfer amount
 * @property {string} contract contract address
 * @property {string} [data] abi encoded string
 * @property {string} blockID
 * @property {number} blockNumber
 * @property {number} timestamp
 * @property {number} [callValue] amount of TRX to send to the contract when triggers.
 * @property {number} [tokenId] id of TRC-10 token to be sent to the contract.
 * @property {number} [tokenValue] amount of TRC-10 token to send to the contract when triggers.
 * @property {number} [feeLimit]
 * @property {number} [expiration]
 */

/**
 * Object for the signing and validation.
 * @typedef {object} prepared 
 * @property {communicationData} commandData data for sending to device
 * @property {communicationData} rawTx unsigned raw transaction
 */