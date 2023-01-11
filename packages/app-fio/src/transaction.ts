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


const { FIOSDK } = require("@fioprotocol/fiosdk");
const { Transactions } = require("@fioprotocol/fiosdk/lib/transactions/Transactions");
import { Api, ApiInterfaces, Ecc, Fio } from "@fioprotocol/fiojs";
import { deserialize, serialize } from "@fioprotocol/fiojs/dist/encryption-fio";
import { checkDecrypt, checkEncrypt } from "@fioprotocol/fiojs/dist/encryption-check";
import { SerialBuffer } from "@fioprotocol/fiojs/dist/chain-serialize";
import { base64ToBinary } from "@fioprotocol/fiojs/dist/chain-numeric";
import { hmac, sha1 } from "hash.js";
import ow from "ow";


export const SDK = new FIOSDK(
    '', // privateKey
    '', // publicKey
    "https://fio.blockpane.com/v1/", // baseUrl
    async (uri: RequestInfo, opts = {}) => {
        return Promise.race([
            fetch(uri, opts),
            new Promise((_, reject) => setTimeout(() => { reject("FIO api timeout") }, 30000))
        ])
    }
);

export function setApiUrl(url: string) {
    Transactions.baseUrl = url;
}


SDK.setSignedTrxReturnOption(true);
Object.freeze(SDK.privateKey);
Object.freeze(SDK.returnPreparedTrx);

let _FioProvider = {
    ...Fio,
    prepareTransaction
};
Object.defineProperty(Transactions, "FioProvider", {
    get() {
        return _FioProvider;
    },
    set(value) {
        _FioProvider = {
            ...value,
            prepareTransaction
        }
    },
    configurable: false
});

Reflect.defineProperty(Transactions.prototype, "getCipherContent", {
    value: function (contentType: string, content: any, privateKey: string, publicKey: string) {
        if (privateKey && publicKey) {
            const cipher = Fio.createSharedCipher({ privateKey, publicKey });
            return cipher.encrypt(contentType, content);
        }

        return SharedCipher.encrypt(contentType, content);
    },
    configurable: false
})


async function prepareTransaction(
    { transaction, chainId, privateKeys, abiMap, textDecoder, textEncoder }: {
        transaction: any,
        chainId: string,
        privateKeys: string[], // treat as bip44 path
        abiMap: Map<string, any>,
        textDecoder?: TextDecoder,
        textEncoder?: TextEncoder,
    }
) {
    if (privateKeys.some(x => !!x)) return Fio.prepareTransaction;

    const abiProvider: ApiInterfaces.AbiProvider = {
        getRawAbi: async function (accountName: string) {
            const rawAbi = abiMap.get(accountName);
            if (!rawAbi) {
                throw new Error(`Missing ABI for account ${accountName}`);
            }
            const abi = base64ToBinary(rawAbi.abi);

            return { accountName: rawAbi.account_name, abi };
        }
    };

    //@ts-ignore
    const api = new Api({
        abiProvider,
        chainId,
        textDecoder,
        textEncoder,
    });
    const { serializedTransaction, serializedContextFreeData } = await api.transact(transaction, { sign: false });

    const tx = Buffer.from(serializedTransaction);
    const sigData = Buffer.concat([
        Buffer.from(chainId, 'hex'),
        tx,
        serializedContextFreeData ?
            Buffer.from(Ecc.sha256(serializedContextFreeData), "hex") :
            Buffer.allocUnsafe(32)
        ,
    ]);

    return {
        signatures: [],
        compression: 0,
        packed_context_free_data: Buffer.from((serializedContextFreeData || new Uint8Array(0))).toString("hex"),
        packed_trx: tx.toString("hex"),
        sigData
    }
}


const emptyBuffer = Buffer.alloc(0);
export class SharedCipher {
    static #sharedSecret: Buffer = emptyBuffer;
    static #textEncoder = new TextEncoder();
    static #textDecoder = new TextDecoder();

    /**
        Encrypt the content of a FIO message.
        @arg {string} fioContentType - `new_funds_content`, etc
        @arg {object} content
        @arg {Buffer} [IV = randomBytes(16)] - An unpredictable strong random value
            is required and supplied by default.  Unit tests may provide a static value
            to achieve predictable results.
        @return {string} cipher base64
    */
    static encrypt(fioContentType: string, content: any, IV?: Buffer): string {
        const buffer = new SerialBuffer({ textEncoder: this.#textEncoder, textDecoder: this.#textDecoder });
        serialize(buffer, fioContentType, content);
        const message = Buffer.from(buffer.asUint8Array());
        const cipherbuffer = checkEncrypt(this.SharedSecret, message, IV);
        this.#sharedSecret = emptyBuffer;

        return cipherbuffer.toString("base64");
    }

    /**
        Decrypt the content of a FIO message.
        @arg {string} fioContentType - `new_funds_content`, etc
        @arg {object} content - cipher base64
        @return {object} decrypted FIO object
    */
    static decrypt(fioContentType: string, content: string): any {
        const message = checkDecrypt(this.SharedSecret, Buffer.from(content, "base64"));
        const messageArray = Uint8Array.from(message);
        const buffer = new SerialBuffer(
            {
                array: messageArray,
                textEncoder: this.#textEncoder,
                textDecoder: this.#textDecoder
            }
        );

        return deserialize(buffer, fioContentType);
    }

    /**
        @example hashA(PublicKey.toBuffer())
        @arg {string|Buffer} key buffer
        @return {string} hex, one-way hash unique to this SharedCipher and key
    */
    static hashA(key: Buffer): String {
        //@ts-ignore
        const h = hmac(sha1, this.SharedSecret);
        const hashed = Buffer.from(h.update(key).digest());

        return `0x${hashed.slice(0, 16).toString("hex")}`;
    }

    static get SharedSecret(): Buffer {
        if (this.#sharedSecret.length === 0) throw Error("Shared secret is empty.");

        return this.#sharedSecret;
    }

    static set SharedSecret(secret: Buffer) {
        ow(secret, ow.buffer.is(x => x.length === 64));

        this.#sharedSecret = secret;
    }
}