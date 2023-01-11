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
    buildPathBuffer, checkFWVersion, FirmwareError, Logger, owTool, Signature, toExtenededPublicKey
} from "@secux/utility";
import {
    base64String, communicationData, getBuffer, ow_communicationData, Send, StatusCode, toAPDUResponse,
    toCommunicationData, TransportStatusError, wrapResult
} from "@secux/utility/lib/communication";
import * as secp256k1 from "@secux/utility/lib/secp256k1";
import * as command from "./command";
import ow from "ow";
import {
    EllipticCurve, IAPDUResponse, ow_EllipticCurve, ow_HardandedPath, ow_TransactionOption, ow_xpubCurve,
    ShowOption, TransactionOption, TransactionType
} from "./interface";
export { SecuxTransactionTool };
const logger = Logger?.child({ id: "protocol" });


const publicKeyPrefix = Buffer.from([0x04]);
const SIGNATURE_LENGTH = 65;
const CONFIRM = (process.env.SECUX_CONFIRM === "off" || process.env.VUE_APP_SECUX_CONFIRM === "off") ? 0x80 : 0x00;
const DEFAULT_CURVE = EllipticCurve.SECP256K1;
const DEFAULT_TRANSTYPE = TransactionType.NORMAL;
const DEFAULT_CHAINID = 0;
const ow_bip32String = owTool.bip32String;


/**
 * Protocol layer of transaction related method
 */
class SecuxTransactionTool {
    /**
     * Resolve response from device.
     * @param {communicationData} response data from device 
     * @returns {IAPDUResponse} response object
     */
    static resolveResponse(response: communicationData): IAPDUResponse {
        ow(response, ow_communicationData);


        const rsp = getBuffer(response);
        const result = toAPDUResponse(rsp);

        return wrapResult({
            status: result.status,
            data: result.data.toString("base64"),
            dataLength: result.dataLength
        });
    }

    /**
     * Query publickey (uncompressed) command.
     * @param {string} path BIP32
     * @param {EllipticCurve} curve 0: SECP256K1, 1: ED25519
     * @returns {communicationData} data for sending to device
     */
    static getPublickey(path: string, curve: EllipticCurve): communicationData {
        ow(path, ow_bip32String);
        ow(curve, ow_EllipticCurve);
        if (curve === EllipticCurve.ED25519) validateHardenedPath(path);


        const { pathBuffer } = buildPathBuffer(path);
        const [cla, ins] = command.GET_PUBLICKEY;
        logger?.debug(`send command ${cla.toString(16)} ${ins.toString(16)} (getPublickey)`);

        return Send(cla, ins, curve, 0, pathBuffer);
    }

    /**
     * Reslove publickey from SecuX device.
     * @param {communicationData} response data from device 
     * @param {EllipticCurve} curve 0: SECP256K1, 1: ED25519
     * @param {boolean} compressed setting for secp256k1
     * @returns {string} publickey (base64 encoded)
     */
    static resolvePublickey(response: communicationData, curve: EllipticCurve, compressed = true): base64String {
        ow(response, ow_communicationData);
        ow(curve, ow_EllipticCurve);
        ow(compressed, ow.boolean);


        const rsp = toAPDUResponse(getBuffer(response));
        if (rsp.status !== StatusCode.SUCCESS) throw new TransportStatusError(rsp.status);

        switch (curve) {
            case EllipticCurve.SECP256K1:
                const publickey_secp256k1 = (compressed) ? toCompressed(rsp.data) : Buffer.concat([publicKeyPrefix, rsp.data]);
                return publickey_secp256k1.toString("base64");

            default:
                return rsp.data.toString("base64");
        }
    }

    /**
     * Query extended publickey command.
     * @param {string} path BIP32
     * @param {EllipticCurve} curve 0: SECP256K1, 2: ED25519_ADA
     * @returns {communicationData} data for sending to device
     */
    static getXPublickey(path: string, curve: EllipticCurve = EllipticCurve.SECP256K1): communicationData {
        ow(path, ow_bip32String);
        ow(curve, ow_xpubCurve);
        if (curve === EllipticCurve.ED25519_ADA) validateHardenedPath(path);


        const { pathBuffer } = buildPathBuffer(path);
        const [cla, ins] = command.GET_XPUBLICKEY;
        logger?.debug(`send command ${cla.toString(16)} ${ins.toString(16)} (getXPublickey)`);

        return Send(cla, ins, curve, 0, pathBuffer);
    }

    /**
     * Reslove extended publickey from SecuX device.
     * @param {communicationData} response data from device 
     * @param {string} path BIP32
     * @param {EllipticCurve} curve 0: SECP256K1, 2: ED25519_ADA
     * @returns {string} xpub
     */
    static resolveXPublickey(response: communicationData, path?: string, curve: EllipticCurve = EllipticCurve.SECP256K1): string {
        ow(response, ow_communicationData);
        ow(curve, ow_xpubCurve);


        const rsp = toAPDUResponse(getBuffer(response));
        if (rsp.status !== StatusCode.SUCCESS) throw new TransportStatusError(rsp.status);

        switch (curve) {
            case EllipticCurve.ED25519_ADA:
                return rsp.data.slice(0, 64).toString("hex");

            default:
                ow(path, ow_bip32String);

                const publicKeyBuffer = rsp.data.slice(0, 64);
                const chainCodeBuffer = rsp.data.slice(64, 64 + 32);
                const fingerPrintBuffer = rsp.data.slice(64 + 32, 64 + 32 + 4);

                const compressed = toCompressed(publicKeyBuffer);
                const publicExtendedKey = toExtenededPublicKey(path, fingerPrintBuffer, chainCodeBuffer, compressed);

                return publicExtendedKey;
        }
    }

    /**
     * Query ECIES shared secret command.
     * @param {string} path BIP32
     * @param {communicationData} publickey secp256k1 compressed publickey
     * @returns {communicationData} data for sending to device
     */
    static getECIESsecret(path: string, publickey: communicationData): communicationData {
        try {
            const { ITransport } = require("@secux/transport");
            const mcu = {
                crypto: "2.25",
                nifty: undefined
            };

            //@ts-ignore
            checkFWVersion("mcu", mcu[ITransport.deviceType], ITransport.mcuVersion);
            checkFWVersion("se", "1.96", ITransport.seVersion);
        } catch (error) {
            if (error instanceof FirmwareError) throw error;
        }
        ow(path, ow_bip32String);
        ow(publickey, ow_communicationData);

        const pubkey = getBuffer(publickey);
        if (pubkey.length !== 33 || !secp256k1.validate(pubkey)) {
            throw Error(`expect compressed secp256k1 publickey, but got ${pubkey.toString("hex")}`);
        }

        const { pathBuffer } = buildPathBuffer(path);
        const payload = Buffer.from([...pathBuffer, ...pubkey]);
        const [cla, ins] = command.GET_ECIES_SECRET;
        logger?.debug(`send command ${cla.toString(16)} ${ins.toString(16)} (getECIESsecret)`);

        return Send(cla, ins, 0, 0, payload);
    }

    /**
     * Reslove ECIES shared secret from SecuX device.
     * @param {communicationData} response data from device 
     * @returns {communicationData} ECIES shared secret
     */
    static resolveECIESsecret(response: communicationData): communicationData {
        ow(response, ow_communicationData);

        const rsp = toAPDUResponse(getBuffer(response));
        if (rsp.status !== StatusCode.SUCCESS) throw new TransportStatusError(rsp.status);

        const secretLength = 64;
        if (rsp.dataLength !== secretLength) {
            logger?.warn(`Received data length error, got "${rsp.data.toString("hex")}"`);
            throw Error('Invalid shared secret length');
        }

        return toCommunicationData(rsp.data);
    }

    /**
     * Sign a hashed transcation command.
     * @param {string} path BIP32
     * @param {communicationData} tx prepared transaction data 
     * @param {TransactionOption} [option] 
     * @returns {communicationData} data for sending to device
     */
    static signTransaction(path: string, tx: communicationData, option?: TransactionOption): communicationData {
        ow(path, ow_bip32String);
        ow(tx, ow_communicationData);
        ow(option as TransactionOption, ow.any(ow.undefined, ow_TransactionOption));
        if (option?.curve === EllipticCurve.ED25519) ow(path, ow_HardandedPath);


        const txBuffer = buildTxBuffer([path], [getBuffer(tx)], option?.tp, option?.chainId);
        const msgBuffer = Buffer.alloc(0);

        const [cla, ins] = command.SIGN_TX;
        logger?.debug(`send command ${cla.toString(16)} ${ins.toString(16)} (signTransaction)`);

        return Send(
            cla, ins, CONFIRM, option?.curve ?? DEFAULT_CURVE,
            Buffer.concat([txBuffer, msgBuffer])
        );
    }

    /**
     * Reslove signature from SecuX device.
     * @param {communicationData} response data from device 
     * @returns {string} signature (base64 encoded)
     */
    static resolveSignature(response: communicationData): base64String {
        ow(response, ow_communicationData);


        const rsp = toAPDUResponse(getBuffer(response));
        if (rsp.status !== StatusCode.SUCCESS) throw new TransportStatusError(rsp.status);

        if (rsp.dataLength !== SIGNATURE_LENGTH) {
            logger?.warn(`Received signature length error, got "${rsp.data.toString("hex")}"`);
            throw Error('Invalid signature length');
        }

        const signature = Signature.fromSignature(rsp.data);
        return Buffer.concat([signature.r, signature.s, signature.v]).toString("base64");
    }

    /**
     * Sign hashed transactions command.
     * @param {Array<string>} paths BIP32
     * @param {Array<Buffer>} txs prepared transaction data corresponding to above path
     * @param {TransactionOption} [otpion] 
     * @returns {communicationData} data for sending to device
     */
    static signTransactionList(paths: Array<string>, txs: Array<Buffer>, option?: TransactionOption): communicationData {
        ow(paths, ow.array.ofType(ow_bip32String));
        ow(txs, ow.array.ofType(ow.buffer));
        ow(option as TransactionOption, ow.any(ow.undefined, ow_TransactionOption));
        if (option?.curve === EllipticCurve.ED25519) ow(paths, ow.array.ofType(ow_HardandedPath));


        const txBuffer = buildTxBuffer(paths, txs, option?.tp, option?.chainId);
        const msgBuffer = Buffer.alloc(0);

        const [cla, ins] = command.SIGN_TX;
        logger?.debug(`send command ${cla.toString(16)} ${ins.toString(16)} (signTransactionList)`);

        return Send(
            cla, ins, CONFIRM, option?.curve ?? DEFAULT_CURVE,
            Buffer.concat([txBuffer, msgBuffer])
        );
    }

    /**
     * Reslove signature from SecuX device.
     * @param {communicationData} response data from device 
     * @returns {Array<string>} signature array of base64 string
     */
    static resolveSignatureList(response: communicationData): Array<base64String> {
        ow(response, ow_communicationData);


        const rsp = toAPDUResponse(getBuffer(response));
        if (rsp.status !== StatusCode.SUCCESS) throw new TransportStatusError(rsp.status);

        if (rsp.dataLength % SIGNATURE_LENGTH !== 0) {
            logger?.warn(`Received signature length error (${SIGNATURE_LENGTH} * k), got "${rsp.data.toString("hex")}" (${rsp.dataLength})`);
            throw Error('Invalid signature length');
        }

        const signatureList = [];
        let offset = 0;
        while (offset < rsp.dataLength) {
            const sig = rsp.data.slice(offset, offset + SIGNATURE_LENGTH);
            offset = offset + SIGNATURE_LENGTH;

            const signature = Signature.fromSignature(sig);
            signatureList.push(
                Buffer.concat([signature.r, signature.s, signature.v])
            );
        }

        if (signatureList.length === 0) {
            logger?.warn(`No signature data in response`);
            throw Error("Invalid signature data");
        }

        return signatureList.map(x => x.toString("base64"));
    }

    /**
     * Sign a transcation command.
     * @param {string} path BIP32
     * @param {communicationData} tx prepared transaction data
     * @param {TransactionOption} [option] 
     * @returns {communicationData} data for sending to device
     */
    static signRawTransaction(path: string, tx: communicationData, option?: TransactionOption): communicationData {
        ow(path, ow_bip32String);
        ow(tx, ow_communicationData);
        ow(option as TransactionOption, ow.any(ow.undefined, ow_TransactionOption));
        if (option?.curve === EllipticCurve.ED25519) ow(path, ow_HardandedPath);


        const txBuffer = buildTxBuffer([path], [getBuffer(tx)], option?.tp, option?.chainId);
        const msgBuffer = Buffer.alloc(0);

        const [cla, ins] = command.SIGN_TX_RAW;
        logger?.debug(`send command ${cla.toString(16)} ${ins.toString(16)} (signRawTransaction)`);

        return Send(
            cla, ins, CONFIRM, option?.curve ?? DEFAULT_CURVE,
            Buffer.concat([txBuffer, msgBuffer])
        );
    }

    /**
     * Sign transactions command.
     * @param {Array<string>} paths BIP32
     * @param {Array<Buffer>} txs prepared transaction data corresponding to above path
     * @param {communicationData} [confirm]
     * @param {TransactionOption} [otpion] 
     * @returns {communicationData} data for sending to device
     */
    static signRawTransactionList(paths: Array<string>, txs: Array<Buffer>, confirm: communicationData = Buffer.alloc(0),
        option?: TransactionOption
    ): communicationData {
        ow(paths, ow.array.ofType(ow_bip32String));
        ow(txs, ow.array.ofType(ow.buffer));
        ow(confirm, ow_communicationData);
        ow(option as TransactionOption, ow.any(ow.undefined, ow_TransactionOption));
        if (option?.curve === EllipticCurve.ED25519) ow(paths, ow.array.ofType(ow_HardandedPath));


        if (paths.length !== txs.length) throw Error("ArgumentError: Inconsistent length of paths and txs");

        txs[0] = Buffer.concat([txs[0], getBuffer(confirm)]);
        const txBuffer = buildTxBuffer(paths, txs, option?.tp, option?.chainId);
        const msgBuffer = Buffer.alloc(0);

        const [cla, ins] = command.SIGN_TX_RAW;
        logger?.debug(`send command ${cla.toString(16)} ${ins.toString(16)} (signRawTransactionList)`);

        return Send(
            cla, ins, CONFIRM, option?.curve ?? DEFAULT_CURVE,
            Buffer.concat([txBuffer, msgBuffer])
        );
    }

    /**
     * Sign message command.
     * @param {string} path BIP32
     * @param {communicationData} msg 
     * @param {TransactionOption} [option] 
     * @returns {communicationData} data for sending to device
     */
    static signMessage(path: string, msg: communicationData, option?: TransactionOption): communicationData {
        ow(path, ow_bip32String);
        ow(msg, ow_communicationData);
        ow(option as TransactionOption, ow.any(ow.undefined, ow_TransactionOption));
        if (option?.curve === EllipticCurve.ED25519) ow(path, ow_HardandedPath);


        msg = getBuffer(msg);

        // Note: transaction type 2 bytes and chainId 2 bytes(little endian)
        const headerBuffer = Buffer.alloc(4);
        headerBuffer.writeUInt16LE(option?.tp ?? DEFAULT_TRANSTYPE, 0);
        headerBuffer.writeUInt16LE(option?.chainId ?? DEFAULT_CHAINID, 2);
        const { pathNum, pathBuffer } = buildPathBuffer(path);

        // Note: message length should fix to 2 bytes
        const messageLenBuf = Buffer.alloc(2);
        messageLenBuf.writeUInt16BE(msg.length, 0);
        const dataBuffer = Buffer.concat([
            Buffer.from([1]), // how many group of path, we just need 1 in Ethereum
            Buffer.concat([Buffer.from([pathNum * 4 + 4]), headerBuffer, pathBuffer]),
            Buffer.concat([messageLenBuf, msg])
        ]);

        const [cla, ins] = command.SIGN_MESSAGE;
        logger?.debug(`send command ${cla.toString(16)} ${ins.toString(16)} (signMessage)`);

        return Send(cla, ins, CONFIRM, option?.curve ?? DEFAULT_CURVE, dataBuffer);
    }

    /**
     * Sign typed message command.
     * @param {string} path BIP32
     * @param {communicationData} typedMessageHash 
     * @param {TransactionOption} [option] 
     * @returns {communicationData} data for sending to device
     */
    static signTypedMessage(path: string, typedMessageHash: communicationData, option?: TransactionOption): communicationData {
        ow(path, ow_bip32String);
        ow(typedMessageHash, ow_communicationData);
        ow(option as TransactionOption, ow.any(ow.undefined, ow_TransactionOption));
        if (option?.curve === EllipticCurve.ED25519) ow(path, ow_HardandedPath);


        typedMessageHash = getBuffer(typedMessageHash);

        const headerBuffer = Buffer.alloc(4);
        headerBuffer.writeUInt16LE(option?.tp ?? DEFAULT_TRANSTYPE, 0);
        headerBuffer.writeUInt16LE(option?.chainId ?? DEFAULT_CHAINID, 2);
        const { pathNum, pathBuffer } = buildPathBuffer(path);

        // Note: typedMessageHash length should fix to 2 bytes
        const typedMessageHashLenBuf = Buffer.alloc(2);
        typedMessageHashLenBuf.writeUInt16BE(typedMessageHash.length, 0);

        const dataBuffer = Buffer.concat([
            Buffer.from([1]), // how many group of path, we just need 1 in Ethereum
            Buffer.concat([Buffer.from([pathNum * 4 + 4]), headerBuffer, pathBuffer]),
            Buffer.concat([typedMessageHashLenBuf, typedMessageHash])
        ]);

        const [cla, ins] = command.SIGN_TYPEDMESSAGE;
        logger?.debug(`send command ${cla.toString(16)} ${ins.toString(16)} (signTypedMessage)`);

        return Send(cla, ins, CONFIRM, option?.curve ?? DEFAULT_CURVE, dataBuffer);
    }

    /**
     * Send utxo command.
     * @deprecated
     * @param {string} path BIP32
     * @param {number} inputId uint8 
     * @param {communicationData} tx 
     * @param {communicationData} confirm
     * @param {boolean} [isToken] 
     * @returns {communicationData} data for sending to device
     */
    static txPrepare(path: string, inputId: number, tx: communicationData, confirm: communicationData, isToken: boolean = false): communicationData {
        ow(path, ow_bip32String);
        ow(inputId, ow.number.inRange(0, 0xff));
        ow(tx, ow_communicationData);
        ow(confirm, ow_communicationData);
        ow(isToken, ow.boolean);


        const { pathNum, pathBuffer } = buildPathBuffer(path);
        if (pathNum !== 5) {
            throw Error('Invalid Path for Signing Transaction');
        }

        const isTokenBuffer = Buffer.alloc(4);
        isTokenBuffer.writeUInt32LE(Number(isToken), 0);

        const dataBuffer = Buffer.concat([
            isTokenBuffer,
            pathBuffer,
            getBuffer(tx),
            getBuffer(confirm)
        ]);

        const [cla, ins] = command.TX_PREPARE;
        logger?.debug(`send command ${cla.toString(16)} ${ins.toString(16)} (txPrepare)`);

        return Send(cla, ins, inputId, 0, dataBuffer);
    }

    /**
     * Begin signing command.
     * @deprecated
     * @param {string} amount 
     * @param {string} toAddress 
     * @param {boolean} [showConfirm] 
     * @returns {communicationData} data for sending to device
     */
    static txBegin(amount: string, toAddress: string, showConfirm: boolean = false): communicationData {
        ow(amount, ow.string.nonEmpty);
        ow(toAddress, ow.string.nonEmpty);
        ow(showConfirm, ow.boolean);


        if (amount.length > 32) throw Error('Invalid parameter of amount length');
        const amountBuffer = Buffer.alloc(32);
        amountBuffer.write(amount);

        if (toAddress.length > 48) throw Error('Invalid parameter of toAddress length');
        const toBuffer = Buffer.alloc(48);
        toBuffer.write(toAddress);

        const [cla, ins] = command.TX_BEGIN;
        logger?.debug(`send command ${cla.toString(16)} ${ins.toString(16)} (txBegin)`);

        return Send(
            cla, ins, Number(showConfirm) | CONFIRM, 0,
            Buffer.concat([amountBuffer, toBuffer])
        );
    }

    /**
     * End signing command.
     * @deprecated
     * @returns {communicationData} data for sending to device
     */
    static txEnd(): communicationData {
        const [cla, ins] = command.TX_END;
        logger?.debug(`send command ${cla.toString(16)} ${ins.toString(16)} (txEnd)`);

        return Send(cla, ins);
    }

    /**
     * Sign command.
     * @deprecated
     * @param {number} inputId uint8
     * @returns {communicationData} data for sending to device
     */
    static txSign(inputId: number): communicationData {
        ow(inputId, ow.number.inRange(0, 0xff));


        const [cla, ins] = command.TX_SIGN;
        logger?.debug(`send command ${cla.toString(16)} ${ins.toString(16)} (txSign)`);

        return Send(cla, ins, inputId);
    }
}


function isHexEven(str: string) {
    const regex = /^[0-9a-fA-F]+[02468aceACE]$/;
    return regex.test(str);
}

function toCompressed(array: Buffer) {
    const xOrdinate = array.slice(0, 32);
    const yOrdinate = array.slice(32, 64);
    let compressedPrefix;
    if (isHexEven(yOrdinate.toString('hex'))) {
        compressedPrefix = Buffer.from([0x02]);
    } else {
        compressedPrefix = Buffer.from([0x03]);
    }

    return Buffer.concat([compressedPrefix, xOrdinate]);
}

function buildTxBuffer(paths: Array<string>, txs: Array<Buffer>,
    tp: TransactionType = DEFAULT_TRANSTYPE,
    chainId: number = DEFAULT_CHAINID
) {
    if (paths.length != txs.length) throw Error('Inconsistent length of paths and txs');

    const head = [], data = [];
    for (let i = 0; i < paths.length; i++) {
        const headerBuffer = Buffer.alloc(4);
        headerBuffer.writeUInt16LE(tp, 0);
        headerBuffer.writeUInt16LE(chainId, 2);

        const path = paths[i];
        const { pathNum, pathBuffer } = buildPathBuffer(path);
        // generic prepare can use 3 or 5 path level key to sign
        if (pathNum !== 5 && pathNum !== 3) throw Error('Invalid Path for Signing Transaction');

        head.push(Buffer.concat([Buffer.from([pathNum * 4 + 4]), headerBuffer, pathBuffer]));


        // fixed 2 byte length
        const preparedTxLenBuf = Buffer.alloc(2);
        preparedTxLenBuf.writeUInt16BE(txs[i].length, 0);
        data.push(Buffer.concat([preparedTxLenBuf, txs[i]]));
    }

    return Buffer.concat([Buffer.from([paths.length]), ...head, ...data]);
}

function buildShownMessageBuffer(balance: string = '0', address: string = '',
    showOption: ShowOption = ShowOption.NONE, msg: string = '') {
    let messageBuf = Buffer.alloc(0);

    switch (showOption) {
        case ShowOption.CONFIRM:
            const balanceSize = 32;
            const outputAddressSize = 48;

            let balanceBuffer = Buffer.alloc(balanceSize);
            balanceBuffer.write(balance);
            // fixed length, but still need a length prefix~
            balanceBuffer = addLengthPrefixToBuffer(balanceBuffer);

            let outputAddressBuffer = Buffer.alloc(outputAddressSize);
            outputAddressBuffer.write(address);
            // fixed length, but still need a length prefix~
            outputAddressBuffer = addLengthPrefixToBuffer(outputAddressBuffer);

            messageBuf = Buffer.concat([balanceBuffer, outputAddressBuffer]);
            break;

        case ShowOption.MESSAGE:
            messageBuf = addLengthPrefixToBuffer(Buffer.from(msg));
            break;
    }

    return messageBuf;
};

function addLengthPrefixToBuffer(data: Buffer) {
    let lenBuf = Buffer.alloc(0);
    const oldHex = data.length.toString(16);
    const hexString = oldHex.length % 2 == 1 ? `0${oldHex}` : oldHex;
    const hex = hexString.match(/[\da-fA-F]{2}/gi);
    if (hex) lenBuf = Buffer.from(hexString, "hex");
    else throw Error('Invalid Input');

    return Buffer.concat([lenBuf, data]);
};

function validateHardenedPath(path: string) {
    const isHardened = !!path.match(/^m(\/\d+')+$/);

    if (!isHardened) throw Error(`ArgumentError: accept hardened path only, got ${path}`);
}


try {
    const { ITransport } = require("@secux/transport");

    Object.defineProperties(ITransport.prototype, {
        getSharedSecret: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (...args: any[]) {
                //@ts-ignore
                const buf = SecuxTransactionTool.getECIESsecret(...args);
                const rsp = await this.Exchange(getBuffer(buf));
                return SecuxTransactionTool.resolveECIESsecret(rsp);
            }
        },
    });
} catch (error) {
    // skip plugin injection 
}


/**
 * Data type for transmission.
 * @typedef {string|Buffer} communicationData
 */

/**
 * Response object from device.
 * @typedef {object} IAPDUResponse
 * @property {number} status StatusCode
 * @property {string} data base64 encoded buffer
 * @property {number} dataLength length of the data
 */

/**
 * Options for the signing
 * @typedef {object} TransactionOption 
 * @property {TransactionType} [tp] the type of payment
 * @property {EllipticCurve} [curve]
 * @property {number} [chainId] for ethereum networks
 */

/**
 * Status code of response.
 * @typedef {enum} StatusCode
 * @property {number} DATA_ERROR 0x5001
 * @property {number} CLA_ERROR 0x5002
 * @property {number} INS_ERROR 0x5003
 * @property {number} SUCCESS 0x9000
 */

/**
 * Supported curve.
 * @typedef {enum} EllipticCurve
 * @property {number} SECP256K1 0
 * @property {number} ED25519 1
 * @property {number} ED25519_ADA 2
 */

/**
 * The type of payment.
 * @typedef {enum} TransactionType
 * @property {number} NORMAL 0
 * @property {number} TOKEN 1
 * @property {number} NFT 2
 */